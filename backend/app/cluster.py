"""Cluster provider: unified interface used by the API.

- mode 'live'      -> real Deployments read/patched via kubectl (real drift + fix)
- mode 'simulated' -> explicitly-labelled in-memory simulation (only when no cluster)
- mode 'unavailable' -> CLUSTER_MODE=real but no cluster: caller must surface an error

Nothing here silently fabricates live data.
"""
from __future__ import annotations

import json
import os
import random
import copy
from pathlib import Path
from typing import Any

from . import k8s, state
from .drift import diff_configs

DATA_DIR = state.DATA_DIR
LIVE_BASELINE_PATH = DATA_DIR / "baseline-live.json"

RECIPES_SIM = state._DRIFT_RECIPES
RECIPES_LIVE = state._DRIFT_RECIPES_LIVE


class ClusterUnavailable(RuntimeError):
    def __init__(self, detail: str):
        super().__init__(detail)
        self.detail = detail


def mode() -> str:
    return k8s.status()["mode"]


def _require() -> str:
    st = k8s.status()
    if st["mode"] == "unavailable":
        raise ClusterUnavailable(st["detail"])
    return st["mode"]


def status() -> dict[str, Any]:
    return k8s.status()


# ---------------------------------------------------------------- baseline

def _load_live_baseline() -> dict[str, dict[str, Any]]:
    if LIVE_BASELINE_PATH.exists():
        try:
            data = json.loads(LIVE_BASELINE_PATH.read_text())
            if data:
                return data
        except json.JSONDecodeError:
            pass
    return {}


def capture_baseline() -> dict[str, Any]:
    """Snapshot current live Deployment configs as the approved baseline."""
    _require()
    wls = k8s.live_workloads()
    baseline = {w["name"]: w["config"] for w in wls}
    LIVE_BASELINE_PATH.write_text(json.dumps(baseline, indent=2))
    return {"captured": sorted(baseline), "path": str(LIVE_BASELINE_PATH)}


def baseline() -> dict[str, dict[str, Any]]:
    if mode() == "simulated":
        return state.get_baseline()
    bl = _load_live_baseline()
    if not bl:
        # first run: the pristine manifest defines the baseline
        capture_baseline()
        bl = _load_live_baseline()
    return bl


# ---------------------------------------------------------------- workloads

def workloads() -> list[dict[str, Any]]:
    m = _require()
    if m == "simulated":
        return state.workload_list()

    bl = baseline()
    out = []
    for w in k8s.live_workloads():
        name = w["name"]
        b = bl.get(name)
        out.append({
            "name": name,
            "namespace": w["namespace"],
            "config": w["config"],
            "fingerprint": w["fingerprint"],
            "baselineFingerprint": state.fingerprint(b) if b else None,
            "matchesBaseline": bool(b) and state.fingerprint(b) == w["fingerprint"],
        })
    return out


def configs() -> dict[str, dict[str, Any]]:
    return {w["name"]: w["config"] for w in workloads()}


def baseline_dict() -> dict[str, dict[str, Any]]:
    return baseline()


# ---------------------------------------------------------------- drift injection

def inject_drift(workload: str | None = None, count: int | None = None) -> dict[str, Any]:
    m = _require()
    if m == "simulated":
        result = state.introduce_drift(workload, count)
        result["clusterMode"] = "simulated"
        result["workloads"] = state.workload_list()
        return result

    bl = baseline()
    names = [workload] if workload else list(bl.keys())
    names = [n for n in names if n in bl]
    if not names:
        raise KeyError(workload)
    n = count or (1 if workload else random.randint(2, 3))
    targets = random.sample(names, min(n, len(names)))
    recipes = random.sample(RECIPES_LIVE, len(targets))

    changed = []
    errors = []
    for name, recipe in zip(targets, recipes):
        try:
            before = k8s.get_config(name)
            target = copy.deepcopy(before)
            fields = recipe(target) or []
            if not fields:
                continue
            k8s.apply_config(name, target)
            after = k8s.get_config(name)
            changed.append({
                "workload": name,
                "fields": sorted({d["path"] for d in diff_configs(after, before)}),
                "beforeFingerprint": state.fingerprint(before),
                "afterFingerprint": state.fingerprint(after),
            })
        except Exception as exc:
            errors.append({"workload": name, "error": str(exc)[:300]})
    result = {
        "injected": changed,
        "clusterMode": "live",
        "simulated": False,
        "note": "Drift applied to the REAL Kubernetes Deployments via kubectl patch.",
    }
    if errors:
        result["errors"] = errors
    return result


# ---------------------------------------------------------------- fix

def fix(name: str) -> dict[str, Any]:
    m = _require()
    if m == "simulated":
        return _fix_simulated(name)

    bl = baseline()
    if name not in bl:
        raise KeyError(name)
    current = k8s.get_config(name)
    target = bl[name]
    diffs = diff_configs(current, target)
    if not diffs:
        return {"workload": name, "applied": False, "verified": True, "clusterMode": "live",
                "reason": "Already matches baseline; nothing to fix.",
                "fingerprint": state.fingerprint(current),
                "baselineFingerprint": state.fingerprint(target)}

    k8s.apply_config(name, target)
    rollout = k8s.wait_rollout(name)
    after = k8s.get_config(name)
    remaining = diff_configs(after, target)
    verified = not remaining

    from . import incidents
    fix_desc = f"Restored live baseline fingerprint {state.fingerprint(target)} via kubectl patch"
    if verified:
        resolved = incidents.resolve_incidents(name, fix_applied=fix_desc)
        failed: list[dict[str, Any]] = []
    else:
        failed = incidents.mark_fix_failed(
            name, f"Fix NOT verified: {len(remaining)} difference(s) remain after kubectl patch")
        resolved = []

    return {
        "workload": name,
        "applied": True,
        "verified": verified,
        "clusterMode": "live",
        "source": "live kubectl patch -> baseline",
        "revertedFields": [d["path"] for d in diffs],
        "fingerprint": state.fingerprint(after),
        "baselineFingerprint": state.fingerprint(target),
        "remainingDifferences": remaining,
        "rollout": rollout,
        "resolvedIncidents": [r["id"] for r in resolved],
        "failedIncidents": [r["id"] for r in failed],
        "rescan": {"stillDrifted": not verified, "healthy": verified},
    }


# ---------------------------------------------------------------- simulated fix (explicit)

def _fix_simulated(name: str) -> dict[str, Any]:
    current = state.get_workloads().get(name)
    bl = state.get_baseline().get(name)
    if current is None or bl is None:
        raise KeyError(name)
    diffs = diff_configs(current, bl)
    if not diffs:
        return {"workload": name, "applied": False, "verified": True, "clusterMode": "simulated",
                "reason": "Already matches baseline; nothing to fix.",
                "fingerprint": state.fingerprint(current), "baselineFingerprint": state.fingerprint(bl)}
    saved = state.set_config(name, bl)
    verified = state.fingerprint(saved) == state.fingerprint(bl)
    from . import incidents
    fix_desc = f"Restored baseline fingerprint {state.fingerprint(bl)} (SIMULATED)"
    if verified:
        resolved = incidents.resolve_incidents(name, fix_applied=fix_desc)
        failed: list[dict[str, Any]] = []
    else:
        failed = incidents.mark_fix_failed(
            name, "Fix NOT verified: simulated config still differs from baseline")
        resolved = []
    return {
        "workload": name, "applied": True, "verified": verified, "clusterMode": "simulated",
        "source": "baseline restore (SIMULATED)",
        "revertedFields": [d["path"] for d in diffs],
        "fingerprint": state.fingerprint(saved), "baselineFingerprint": state.fingerprint(bl),
        "resolvedIncidents": [r["id"] for r in resolved],
        "failedIncidents": [r["id"] for r in failed],
        "rescan": {"stillDrifted": not verified, "healthy": verified},
    }


def reset_demo() -> dict[str, Any]:
    """Restore pristine state: re-apply the manifest on a live cluster, reset simulation otherwise."""
    if mode() == "unavailable":
        raise ClusterUnavailable(k8s.status()["detail"])
    out: dict[str, Any] = {"clusterMode": mode()}
    if mode() == "live":
        out["apply"] = k8s.apply_pristine()
        for name in k8s.list_deployments():
            try:
                k8s.wait_rollout(name, timeout="30s")
            except Exception:
                pass
        out["baseline"] = capture_baseline()
    else:
        state.reset_all()
    k8s.reset()
    from . import incidents
    incidents.clear()
    return out
