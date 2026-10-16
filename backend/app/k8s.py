"""Kubernetes adapter.

LIVE: reads real Deployments via kubectl (config fingerprinting, drift, fix) and uses real
      scale / rollout when a cluster context is available.
FALLBACK: an explicit, clearly-labelled in-memory simulation when no cluster is reachable.

CLUSTER_MODE = auto (live if a context exists) | real (require live) | simulated.
"""
from __future__ import annotations

import json
import os
import shutil
import subprocess
import time
from pathlib import Path
from typing import Any

_state: dict[str, dict[str, Any]] = {}  # simulated cluster ops state
_sim_workloads: dict[str, dict[str, Any]] = {}  # simulated configs (used when cluster is unavailable)
_probe: dict[str, Any] | None = None

_SIMULATED_ROLLOUT_SECONDS = float(os.environ.get("SIMULATED_ROLLOUT_SECONDS", "4"))
_DEMO_WORKLOADS = ["checkout-api", "payments-worker", "auth-service", "inventory-api", "notification-consumer"]


def namespace() -> str:
    return os.environ.get("CONFIGCOP_NAMESPACE", "prod")


def manifest_path() -> Path:
    default = Path(__file__).resolve().parents[2] / "k8s" / "demo-workloads.yaml"
    return Path(os.environ.get("CONFIGCOP_MANIFEST", default))


def _exe() -> str:
    return shutil.which("kubectl") or "kubectl"


def _kubectl(args: list[str], timeout: float = 12.0) -> subprocess.CompletedProcess:
    return subprocess.run([_exe(), *args], capture_output=True, text=True, timeout=timeout)


def _iso(ts: float | None = None) -> str:
    from datetime import datetime, timezone
    return datetime.fromtimestamp(ts or time.time(), timezone.utc).isoformat(timespec="seconds")


# ---------------------------------------------------------------- connectivity

def probe(force: bool = False) -> dict[str, Any]:
    """Check kubectl + cluster reachability. Result is cached briefly."""
    global _probe
    if _probe and not force and (time.time() - _probe.get("_ts", 0)) < 10:
        return _probe

    if shutil.which("kubectl") is None:
        _probe = {"available": False, "kubectl": False, "context": None,
                  "error": "kubectl not found on PATH", "_ts": time.time()}
        return _probe
    try:
        ctx = _kubectl(["config", "current-context"], timeout=6)
        if ctx.returncode != 0 or not ctx.stdout.strip():
            _probe = {"available": False, "kubectl": True, "context": None,
                      "error": "no kubectl context set (run: minikube start / kubectl config use-context)", "_ts": time.time()}
            return _probe
        context = ctx.stdout.strip()
        ver = _kubectl(["version", "-o", "json"], timeout=10)
        server_ok = False
        server_version = None
        if ver.returncode == 0:
            try:
                data = json.loads(ver.stdout)
                server_version = data.get("serverVersion", {}).get("gitVersion")
                server_ok = bool(server_version)
            except json.JSONDecodeError:
                pass
        if not server_ok:
            err = (ver.stderr or ver.stdout or "").strip().splitlines()
            _probe = {"available": False, "kubectl": True, "context": context,
                      "error": f"cluster API unreachable: {err[-1] if err else 'unknown error'}", "_ts": time.time()}
            return _probe
        _probe = {"available": True, "kubectl": True, "context": context,
                  "serverVersion": server_version, "namespace": namespace(), "error": None, "_ts": time.time()}
        return _probe
    except subprocess.TimeoutExpired:
        _probe = {"available": False, "kubectl": True, "context": None,
                  "error": "kubectl timed out reaching the cluster API", "_ts": time.time()}
        return _probe
    except Exception as exc:  # pragma: no cover - defensive
        _probe = {"available": False, "kubectl": shutil.which("kubectl") is not None, "context": None,
                  "error": f"{type(exc).__name__}: {exc}", "_ts": time.time()}
        return _probe


def status() -> dict[str, Any]:
    """Resolved mode for the API/UI (never silently fakes 'live')."""
    forced = os.environ.get("CLUSTER_MODE", "auto").strip().lower() or "auto"
    p = probe()
    if forced == "simulated":
        mode = "simulated"
    elif forced == "real":
        mode = "live" if p["available"] else "unavailable"
    else:
        mode = "live" if p["available"] else "simulated"

    if mode == "live":
        detail = f"connected to context '{p['context']}' (kubernetes {p.get('serverVersion') or '?'})"
    elif mode == "unavailable":
        detail = f"CLUSTER_MODE=real but no cluster: {p['error']}"
    else:
        detail = f"no live cluster ({p['error']}); using explicitly-labelled simulation"

    return {
        "mode": mode,
        "available": p["available"],
        "kubectl": p["kubectl"],
        "context": p["context"],
        "serverVersion": p.get("serverVersion"),
        "namespace": namespace(),
        "forced": forced,
        "error": None if p["available"] else p["error"],
        "detail": detail,
        "live": mode == "live",
    }


def reset_cache() -> None:
    global _probe
    _probe = None


# ---------------------------------------------------------------- live reads

def _read_deployment(name: str) -> dict[str, Any]:
    proc = _kubectl(["get", "deployment", name, "-n", namespace(), "-o", "json"], timeout=15)
    if proc.returncode != 0:
        raise RuntimeError(proc.stderr.strip() or f"kubectl get deployment {name} failed")
    return json.loads(proc.stdout)


def _container(dep: dict[str, Any]) -> dict[str, Any]:
    containers = dep["spec"]["template"]["spec"].get("containers", [])
    for c in containers:
        if c.get("name") == "app":
            return c
    return containers[0]


def _probe_cfg(probe_obj: dict[str, Any] | None) -> dict[str, Any]:
    probe_obj = probe_obj or {}
    http = probe_obj.get("httpGet") or {}
    return {"path": http.get("path", ""), "initialDelaySeconds": int(probe_obj.get("initialDelaySeconds", 0) or 0)}


def get_config(name: str) -> dict[str, Any]:
    """Map a live Deployment into Config Cop's config shape (=== simulated shape)."""
    dep = _read_deployment(name)
    c = _container(dep)
    env = {e["name"]: str(e.get("value", "")) for e in c.get("env", []) if "name" in e}
    res = c.get("resources") or {}
    return {
        "name": name,
        "namespace": dep["metadata"]["namespace"],
        "image": c.get("image", ""),
        "replicas": int(dep["spec"].get("replicas", 1)),
        "resources": {
            "requests": dict(res.get("requests", {})),
            "limits": dict(res.get("limits", {})),
        },
        "env": env,
        "probes": {
            "liveness": _probe_cfg(c.get("livenessProbe")),
            "readiness": _probe_cfg(c.get("readinessProbe")),
        },
    }


def list_deployments() -> list[str]:
    proc = _kubectl(["get", "deployments", "-n", namespace(), "-o",
                     "jsonpath={range .items[*]}{.metadata.name}{\"\\n\"}{end}"], timeout=15)
    if proc.returncode != 0:
        raise RuntimeError(proc.stderr.strip() or "kubectl get deployments failed")
    names = [n.strip() for n in proc.stdout.splitlines() if n.strip()]
    return names


def live_workloads() -> list[dict[str, Any]]:
    from . import state  # local import to avoid cycle

    names = list_deployments()
    out = []
    for name in names:
        cfg = get_config(name)
        out.append({
            "name": name,
            "namespace": cfg["namespace"],
            "config": cfg,
            "fingerprint": state.fingerprint(cfg),
        })
    return out


# ---------------------------------------------------------------- live writes

def _manifest_patch(cfg: dict[str, Any]) -> dict[str, Any]:
    c: dict[str, Any] = {"name": "app"}
    if cfg.get("image"):
        c["image"] = cfg["image"]
    if cfg.get("env") is not None:
        c["env"] = [{"name": k, "value": str(v)} for k, v in cfg["env"].items()]
    if cfg.get("resources"):
        r = cfg["resources"]
        c["resources"] = {}
        if r.get("requests"):
            c["resources"]["requests"] = dict(r["requests"])
        if r.get("limits"):
            c["resources"]["limits"] = dict(r["limits"])
    probes = cfg.get("probes", {})
    for kind in ("liveness", "readiness"):
        p = probes.get(kind)
        if isinstance(p, dict):
            entry: dict[str, Any] = {}
            if p.get("initialDelaySeconds") is not None:
                entry["initialDelaySeconds"] = int(p["initialDelaySeconds"])
            if p.get("path"):
                entry["httpGet"] = {"path": p["path"], "port": 80}
            if entry:
                c[f"{kind}Probe"] = entry

    patch: dict[str, Any] = {"spec": {"template": {"spec": {"containers": [c]}}}}
    if cfg.get("replicas") is not None:
        patch["spec"]["replicas"] = int(cfg["replicas"])
    return patch


def apply_config(name: str, cfg: dict[str, Any]) -> dict[str, Any]:
    """Patch a live Deployment to match cfg (strategic merge). Raises on failure."""
    patch = json.dumps(_manifest_patch(cfg))
    proc = _kubectl(["patch", "deployment", name, "-n", namespace(), "--type", "strategic", "-p", patch], timeout=20)
    if proc.returncode != 0:
        raise RuntimeError(proc.stderr.strip() or f"kubectl patch {name} failed")
    return {"patched": True, "workload": name, "output": proc.stdout.strip()[:200]}


def wait_rollout(name: str, timeout: str = "45s") -> dict[str, Any]:
    proc = _kubectl(["rollout", "status", f"deployment/{name}", "-n", namespace(), f"--timeout={timeout}"], timeout=60)
    ok = proc.returncode == 0
    return {"ok": ok, "status": "Complete" if ok else "Progressing",
            "reason": (proc.stdout or proc.stderr).strip()[:300]}


def apply_pristine() -> dict[str, Any]:
    path = manifest_path()
    if not path.exists():
        raise FileNotFoundError(f"manifest not found: {path}")
    proc = _kubectl(["apply", "-f", str(path)], timeout=60)
    if proc.returncode != 0:
        raise RuntimeError(proc.stderr.strip() or "kubectl apply failed")
    return {"applied": True, "manifest": str(path), "output": proc.stdout.strip()[:400]}


# ---------------------------------------------------------------- live scale/rollout

def live_scale(workload: str, replicas: int) -> dict[str, Any]:
    proc = _kubectl(["scale", f"deployment/{workload}", "-n", namespace(), f"--replicas={replicas}"], timeout=20)
    if proc.returncode != 0:
        raise RuntimeError(proc.stderr.strip() or "kubectl scale failed")
    return {"ok": True, "replicas": replicas, "output": proc.stdout.strip()[:200]}


def live_rollout(workload: str) -> dict[str, Any]:
    dep = _read_deployment(workload)
    st = dep.get("status", {})
    spec_replicas = int(dep["spec"].get("replicas", 1))
    available = int(st.get("availableReplicas", 0) or 0)
    ready = int(st.get("readyReplicas", 0) or 0)
    progress = st.get("conditions", [])
    progressing = next((c for c in progress if c.get("type") == "Progressing"), None)
    complete = available >= spec_replicas and spec_replicas > 0
    return {
        "mode": "live",
        "workload": workload,
        "status": "Complete" if complete else "Progressing",
        "reason": (progressing or {}).get("message", f"{available}/{spec_replicas} replicas available")[:300],
        "availableReplicas": available,
        "readyReplicas": ready,
        "desiredReplicas": spec_replicas,
        "updatedAt": _iso(),
        "simulated": False,
    }


# ---------------------------------------------------------------- simulated ops (explicit)

def _ensure_sim(workload: str, default_replicas: int) -> dict[str, Any]:
    if workload not in _state:
        _state[workload] = {
            "liveReplicas": default_replicas,
            "desiredReplicas": default_replicas,
            "rollout": {"status": "Complete", "reason": "Rollout converged", "updatedAt": _iso()},
            "updatedAt": _iso(),
        }
    return _state[workload]


def scale(workload: str, replicas: int, spec_replicas: int) -> dict[str, Any]:
    replicas = max(0, min(50, int(replicas)))
    st = _ensure_sim(workload, spec_replicas)
    if status()["live"]:
        live_scale(workload, replicas)
        return {"mode": "live", "ok": True, "workload": workload, "replicas": replicas, "simulated": False}
    st["desiredReplicas"] = replicas
    st["rollout"] = {"status": "Progressing", "reason": f"Scaling to {replicas} replica(s)",
                     "updatedAt": _iso(), "startedAt": time.time()}
    return {"mode": "simulated", "ok": True, "workload": workload, "replicas": replicas, "simulated": True}


def rollout_status(workload: str, spec_replicas: int) -> dict[str, Any]:
    if status()["live"]:
        return live_rollout(workload)
    st = _ensure_sim(workload, spec_replicas)
    started = st["rollout"].get("startedAt")
    if st["rollout"]["status"] == "Progressing" and started and (time.time() - started) >= _SIMULATED_ROLLOUT_SECONDS:
        st["rollout"] = {"status": "Complete",
                         "reason": f"Successfully rolled out to {st['desiredReplicas']} replica(s)",
                         "updatedAt": _iso()}
        st["liveReplicas"] = st["desiredReplicas"]
    r = st["rollout"]
    return {"mode": "simulated", "modeNote": "simulated", "workload": workload, "status": r["status"],
            "reason": r["reason"], "availableReplicas": st["liveReplicas"], "desiredReplicas": st["desiredReplicas"],
            "updatedAt": r["updatedAt"], "simulated": True}


def overview(workloads: list[dict[str, Any]]) -> list[dict[str, Any]]:
    out = []
    for w in workloads:
        try:
            out.append(rollout_status(w["name"], w["config"].get("replicas", 1)))
        except Exception as exc:
            out.append({"workload": w["name"], "status": "Unknown", "reason": str(exc)[:200],
                        "simulated": False, "error": True})
    return out


def reset() -> None:
    _state.clear()
    _sim_workloads.clear()
    reset_cache()
