"""Simulated Kubernetes workload state, config fingerprinting and baseline handling.

SIMULATION NOTE: workload configs are simulated in-memory (no cluster required).
When a real kubectl context is available, k8s.py adds live scale/rollout calls.
"""
from __future__ import annotations

import copy
import hashlib
import json
import os
import random
import threading
from pathlib import Path
from typing import Any

DATA_DIR = Path(os.environ.get("CONFIGCOP_DATA", Path(__file__).resolve().parents[1] / "data"))
DATA_DIR.mkdir(parents=True, exist_ok=True)
BASELINE_PATH = DATA_DIR / "baseline.json"

_lock = threading.Lock()


def _wl(name, image, replicas, cpu_req, cpu_lim, mem_req, mem_lim, env, delay=10, path="/healthz"):
    return {
        "name": name,
        "namespace": "prod",
        "image": image,
        "replicas": replicas,
        "resources": {
            "requests": {"cpu": cpu_req, "memory": mem_req},
            "limits": {"cpu": cpu_lim, "memory": mem_lim},
        },
        "env": env,
        "probes": {
            "liveness": {"path": path, "initialDelaySeconds": delay},
            "readiness": {"path": path.replace("healthz", "ready") if "healthz" in path else path, "initialDelaySeconds": delay},
        },
    }


def _pristine_workloads() -> dict[str, dict[str, Any]]:
    wls = [
        _wl(
            "checkout-api", "registry.local/checkout-api:1.4.2", 3,
            "250m", "500m", "256Mi", "512Mi",
            {"LOG_LEVEL": "info", "FEATURE_PAYMENTS_V2": "true", "DB_POOL_SIZE": "10", "TIMEOUT_MS": "2000"},
        ),
        _wl(
            "payments-worker", "registry.local/payments-worker:2.1.0", 2,
            "200m", "400m", "512Mi", "1Gi",
            {"LOG_LEVEL": "info", "QUEUE_CONCURRENCY": "8", "DB_POOL_SIZE": "12", "RETRY_LIMIT": "5"},
        ),
        _wl(
            "auth-service", "registry.local/auth-service:3.0.7", 4,
            "150m", "300m", "256Mi", "512Mi",
            {"LOG_LEVEL": "warn", "TOKEN_TTL_SECONDS": "900", "SESSION_SECRET_ROTATION": "enabled"},
            delay=15, path="/healthz",
        ),
        _wl(
            "inventory-api", "registry.local/inventory-api:0.9.4", 2,
            "100m", "250m", "128Mi", "256Mi",
            {"LOG_LEVEL": "info", "CACHE_TTL": "60", "DB_POOL_SIZE": "6"},
            delay=5, path="/healthz",
        ),
        _wl(
            "notification-consumer", "registry.local/notification-consumer:1.2.3", 3,
            "200m", "500m", "256Mi", "512Mi",
            {"LOG_LEVEL": "info", "SMTP_RATE_LIMIT": "100", "BATCH_SIZE": "50"},
        ),
    ]
    return {w["name"]: w for w in wls}


# ---------------------------------------------------------------- fingerprint

def canonical(config: dict[str, Any]) -> str:
    return json.dumps(config, sort_keys=True, separators=(",", ":"))


def fingerprint(config: dict[str, Any]) -> str:
    return hashlib.sha256(canonical(config).encode()).hexdigest()[:12]


# ---------------------------------------------------------------- runtime state

_current: dict[str, dict[str, Any]] = _pristine_workloads()
_baseline: dict[str, dict[str, Any]] = {}


def _load_or_capture_baseline() -> None:
    global _baseline
    if BASELINE_PATH.exists():
        try:
            _baseline = json.loads(BASELINE_PATH.read_text())
            if set(_baseline) == set(_current):
                return
        except json.JSONDecodeError:
            pass
    _baseline = copy.deepcopy(_current)
    BASELINE_PATH.write_text(json.dumps(_baseline, indent=2))


_load_or_capture_baseline()


def get_workloads() -> dict[str, dict[str, Any]]:
    with _lock:
        return copy.deepcopy(_current)


def get_baseline() -> dict[str, dict[str, Any]]:
    with _lock:
        return copy.deepcopy(_baseline)


def workload_list() -> list[dict[str, Any]]:
    with _lock:
        out = []
        for name, cfg in _current.items():
            b = _baseline.get(name, {})
            out.append({
                "name": name,
                "namespace": cfg["namespace"],
                "config": copy.deepcopy(cfg),
                "fingerprint": fingerprint(cfg),
                "baselineFingerprint": fingerprint(b),
                "matchesBaseline": fingerprint(cfg) == fingerprint(b),
            })
        return out


def set_config(name: str, config: dict[str, Any]) -> dict[str, Any]:
    with _lock:
        if name not in _current:
            raise KeyError(name)
        _current[name] = copy.deepcopy(config)
        return copy.deepcopy(_current[name])


def reset_all() -> None:
    with _lock:
        _current.clear()
        _current.update(_pristine_workloads())


# ---------------------------------------------------------------- drift injection

_DRIFT_RECIPES = [
    # (mutator(config) -> list of changed field paths)
    lambda c: [_set(c, ["image"], c["image"].rsplit(":", 1)[0] + ":1.5.0") or "image"],
    lambda c: [_set(c, ["resources", "limits", "cpu"], "50m") or "resources.limits.cpu"],
    lambda c: [_set(c, ["resources", "requests", "memory"], "4Gi") or "resources.requests.memory"],
    lambda c: [_set(c, ["env", "LOG_LEVEL"], "debug") or "env.LOG_LEVEL"],
    lambda c: [_set(c, ["replicas"], max(1, int(c["replicas"]) - 2)) or "replicas"],
    lambda c: [_set(c, ["probes", "liveness", "initialDelaySeconds"], 120) or "probes.liveness.initialDelaySeconds"],
    lambda c: [_set(c, ["env", "DB_POOL_SIZE"], "200") or "env.DB_POOL_SIZE"],
    lambda c: [_set(c, ["resources", "limits", "memory"], "8Gi") or "resources.limits.memory"],
    lambda c: [_set(c, ["replicas"], int(c["replicas"]) + 5) or "replicas"],
]


def _set(cfg: dict, path: list[str], value):
    node = cfg
    for p in path[:-1]:
        node = node[p]
    node[path[-1]] = value
    return None  # caller returns field path string


# Live-safe recipes: only change values a real cluster can reconcile (no broken image tags,
# and always a valid spec: cpu/memory request <= limit).
def _parse_cpu_m(v: str) -> float:
    v = str(v)
    return float(v[:-1]) if v.endswith("m") else float(v) * 1000


def _parse_mem_mi(v: str) -> float:
    v = str(v)
    if v.endswith("Gi"):
        return float(v[:-2]) * 1024
    if v.endswith("Mi"):
        return float(v[:-2])
    if v.endswith("Ki"):
        return float(v[:-2]) / 1024
    return float(v) / (1024 * 1024)


def _drift_cpu_limit(c):
    req = _parse_cpu_m(c["resources"]["requests"].get("cpu", "100m"))
    new = int(req * 4) + 250  # always >= request
    return [_set(c, ["resources", "limits", "cpu"], f"{new}m") or "resources.limits.cpu"]


def _drift_mem_request(c):
    lim = _parse_mem_mi(c["resources"]["limits"].get("memory", "512Mi"))
    new = max(16, int(lim // 4))  # always <= limit
    return [_set(c, ["resources", "requests", "memory"], f"{new}Mi") or "resources.requests.memory"]


def _drift_mem_limit(c):
    lim = _parse_mem_mi(c["resources"]["limits"].get("memory", "512Mi"))
    new = int(lim * 8)
    new_s = f"{new // 1024}Gi" if new >= 1024 else f"{new}Mi"  # always >= request
    return [_set(c, ["resources", "limits", "memory"], new_s) or "resources.limits.memory"]


_DRIFT_RECIPES_LIVE = [
    lambda c: [_set(c, ["env", "LOG_LEVEL"], "debug") or "env.LOG_LEVEL"],
    _drift_cpu_limit,
    _drift_mem_request,
    _drift_mem_limit,
    lambda c: [_set(c, ["replicas"], max(1, int(c["replicas"]) - 2)) or "replicas"],
    lambda c: [_set(c, ["env", "DB_POOL_SIZE"], "200") or "env.DB_POOL_SIZE"],
    lambda c: [_set(c, ["probes", "liveness", "initialDelaySeconds"], 120) or "probes.liveness.initialDelaySeconds"],
    lambda c: [_set(c, ["image"], "nginx:1.24-alpine") or "image"],
]


def introduce_drift(workload: str | None = None, count: int | None = None) -> dict[str, Any]:
    """Mutate live configs away from baseline. Returns what changed."""
    with _lock:
        names = [workload] if workload else list(_current.keys())
        names = [n for n in names if n in _current]
        if not names:
            raise KeyError(workload)
        n = count or (1 if workload else random.randint(2, 3))
        targets = random.sample(names, min(n, len(names)))
        recipes = random.sample(_DRIFT_RECIPES, len(targets))
        changed = []
        for name, recipe in zip(targets, recipes):
            before = canonical(_current[name])
            fields = recipe(_current[name]) or []
            after = canonical(_current[name])
            changed.append({
                "workload": name,
                "fields": fields,
                "beforeFingerprint": hashlib.sha256(before.encode()).hexdigest()[:12],
                "afterFingerprint": hashlib.sha256(after.encode()).hexdigest()[:12],
            })
        return {"injected": changed, "simulated": True}
