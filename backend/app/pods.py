"""Pods + container logs: real kubectl reads in live mode, clearly-labelled
simulated data otherwise (never silently pretends to be live).

Also produces a plain-language summary of pod log lines so the UI can explain
what the logs *mean*, not just dump them.
"""
from __future__ import annotations

import json
import re
import time
from typing import Any

from . import activity, k8s


# ---------------------------------------------------------------- pods

def list_pods() -> dict[str, Any]:
    st = k8s.status()
    if st["live"]:
        return {"pods": _live_pods(), "live": True, "namespace": st["namespace"]}
    return {"pods": _simulated_pods(), "live": False, "namespace": st["namespace"],
            "note": "no live cluster — pods shown are simulated"}


def _live_pods() -> list[dict[str, Any]]:
    proc = k8s._kubectl(["get", "pods", "-n", k8s.namespace(), "-o", "json"], timeout=15)
    if proc.returncode != 0:
        raise RuntimeError(proc.stderr.strip() or "kubectl get pods failed")
    items = json.loads(proc.stdout).get("items", [])
    pods = []
    for p in items:
        meta = p.get("metadata", {})
        status = p.get("status", {})
        spec = p.get("spec", {})
        cs = status.get("containerStatuses") or []
        c0 = cs[0] if cs else {}
        ready = bool(c0.get("ready"))
        restarts = int(c0.get("restartCount", 0) or 0)
        waiting = (c0.get("state") or {}).get("waiting") or {}
        pods.append({
            "name": meta.get("name", "?"),
            "app": (meta.get("labels") or {}).get("app", (meta.get("labels") or {}).get("demo", "?")),
            "phase": status.get("phase", "?"),
            "ready": ready,
            "restarts": restarts,
            "reason": waiting.get("reason") or "",
            "node": spec.get("nodeName", ""),
            "startedAt": status.get("startTime", ""),
            "live": True,
        })
    pods.sort(key=lambda x: (x["app"], x["name"]))
    return pods


def _simulated_pods() -> list[dict[str, Any]]:
    from . import state
    pods = []
    for w in state.workload_list():
        name, replicas = w["name"], int(w["config"].get("replicas", 1))
        for i in range(replicas):
            pods.append({
                "name": f"{name}-sim-{i + 1}",
                "app": name,
                "phase": "Running",
                "ready": True,
                "restarts": 0,
                "reason": "",
                "node": "simulated-node",
                "startedAt": "",
                "live": False,
            })
    return pods


def delete_pod(name: str) -> dict[str, Any]:
    st = k8s.status()
    if not st["live"]:
        raise RuntimeError("pod deletion needs a live cluster (current mode is SIMULATED)")
    proc = k8s._kubectl(["delete", "pod", name, "-n", k8s.namespace(), "--wait=false"], timeout=20)
    if proc.returncode != 0:
        err = proc.stderr.strip()
        if "NotFound" in err:
            raise KeyError(name)
        raise RuntimeError(err or f"kubectl delete pod {name} failed")
    activity.log("pod.delete",
                 f"Pod {name} deleted — the ReplicaSet will recreate it immediately (Kubernetes self-healing)",
                 workload=name.split("-rs")[0] if "-rs" in name else None, level="warn")
    return {"deletedPod": name, "ok": True, "live": True,
            "note": "ReplicaSet is recreating the pod — this heals the pod, not the config"}


# ---------------------------------------------------------------- logs

_LOG_PATTERNS = [
    # (regex, plain-language explanation) — checked in order, first match wins
    (r"(?i)oomkilled|out of memory", "the container was killed for using more memory than its limit (OOMKilled)"),
    (r"(?i)error|failed|exception", "the application logged an error in this window"),
    (r"(?i)warn", "warnings were logged — usually non-fatal but worth reviewing"),
    (r"(?i)readyz|healthz|GET / HTTP/1.1\" 200", "health probes are answering — Kubernetes considers the pod healthy"),
    (r"(?i)GET / HTTP/1.1\" 200", "normal traffic — the web server answered successfully"),
]


def explain_log_lines(lines: list[str]) -> dict[str, Any]:
    """Summarise what the log lines actually mean (plain language)."""
    if not lines:
        return {"summary": "No log output in this window — the container may have just started.",
                "errors": 0, "warnings": 0}
    errors = sum(1 for l in lines if re.search(r"(?i)\berror\b|failed|exception", l))
    warnings = sum(1 for l in lines if re.search(r"(?i)\bwarn(ing)?\b", l))
    oom = any(re.search(r"(?i)oomkilled|out of memory", l) for l in lines)
    parts = [f"{len(lines)} line(s) in this window"]
    if oom:
        parts.append("the container was OOMKilled — it exceeded its memory limit")
    elif errors:
        parts.append(f"{errors} error line(s) — the app is logging failures")
    elif warnings:
        parts.append(f"{warnings} warning line(s)")
    else:
        parts.append("no errors — normal health/traffic output")
    return {"summary": "; ".join(parts) + ".", "errors": errors, "warnings": warnings, "oom": oom}


def workload_logs(workload: str, tail: int = 100) -> dict[str, Any]:
    tail = max(10, min(500, int(tail)))
    st = k8s.status()
    if st["live"]:
        proc = k8s._kubectl(["logs", f"deployment/{workload}", "-n", k8s.namespace(),
                             f"--tail={tail}", "--all-containers=true"], timeout=15)
        raw = (proc.stdout or "").strip()
        err = (proc.stderr or "").strip()
        lines = raw.splitlines() if raw else []
        if proc.returncode != 0 and not lines:
            raise RuntimeError(err or f"kubectl logs {workload} failed")
        source = "live kubectl logs"
    else:
        lines = _simulated_logs(workload, tail)
        source = "SIMULATED (no live cluster — these lines are generated by the demo)"

    summary = explain_log_lines(lines)
    return {
        "workload": workload,
        "source": source,
        "live": st["live"],
        "tail": tail,
        "lines": lines[-tail:],
        "count": len(lines),
        "analysis": summary,
        "at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "stderr": err[:200] if st["live"] else "",
    }


def _simulated_logs(workload: str, tail: int) -> list[dict[str, Any]]:
    """Deterministic, clearly-simulated log lines that explain what the demo did."""
    from . import state as state_mod
    cfg = state_mod.get_workloads().get(workload, {})
    baseline = state_mod.get_baseline().get(workload, {})
    drifted = [k for k in set(cfg) | set(baseline) if cfg.get(k) != baseline.get(k)] if cfg and baseline else []
    ts = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    lines = [
        f"{ts} [simulated] {workload} starting (SIMULATED pod — no live cluster)",
        f"{ts} [simulated] config loaded: image={cfg.get('image', '?')} replicas={cfg.get('replicas', '?')}",
    ]
    if drifted:
        lines.append(f"{ts} [simulated][WARN] config drift active: {', '.join(sorted(drifted))} differ from baseline")
        lines.append(f"{ts} [simulated][ERROR] {workload} misconfigured — drifted fields can cause throttling/restarts")
    else:
        lines.append(f"{ts} [simulated] health OK — config matches approved baseline")
        lines.append(f"{ts} [simulated][INFO] GET /healthz 200 in 2ms")
    # pad with plausible traffic so the panel looks alive
    now = time.time()
    for i in range(max(0, tail - len(lines))):
        t = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(now - (tail - i)))
        lines.append(f"{t} [simulated][INFO] GET / 200 — request handled ({workload})")
    return lines
