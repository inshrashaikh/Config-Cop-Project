"""Self-healing watcher: auto-detect config drift and restore the approved baseline.

Runs as a background asyncio task started by the API on startup. Every pass it
re-reads the workloads, diffs them against the baseline and — for each drifted
workload — applies the same validated fix the manual button uses (real kubectl
patch in live mode, the labelled simulation otherwise). It never invents config:
the only fix it can ever apply is "restore the previously approved baseline".
"""
from __future__ import annotations

import asyncio
import time
from datetime import datetime, timezone
from typing import Any

from . import activity, cluster
from .drift import detect_drift

DEFAULT_INTERVAL = 8
MAX_EVENTS = 50

_state: dict[str, Any] = {
    "enabled": False,
    "interval": DEFAULT_INTERVAL,
    "passes": 0,
    "healed": 0,
    "lastRunAt": None,
    "lastResult": None,
    "driftFound": 0,
    "events": [],          # newest first: {at, workload, verified, revertedFields, mode, error?}
}
_lock = asyncio.Lock()
_task: asyncio.Task | None = None


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def status() -> dict[str, Any]:
    st = dict(_state)
    st["events"] = list(_state["events"])
    st["mode"] = ("live kubectl restore" if cluster.mode() == "live"
                  else "baseline restore (SIMULATED)" if cluster.mode() == "simulated"
                  else "unavailable")
    st["running"] = bool(_task and not _task.done())
    return st


def set_enabled(enabled: bool, interval: int | None = None) -> dict[str, Any]:
    if interval:
        _state["interval"] = max(3, min(300, int(interval)))
    _state["enabled"] = bool(enabled)
    activity.log(
        "selfheal.toggle",
        (f"Self-heal ENABLED — watching every {_state['interval']}s and restoring the baseline on drift"
         if enabled else "Self-heal DISABLED — drift will stay until a manual fix"),
        level="success" if enabled else "warn",
    )
    return status()


def _record(event: dict[str, Any]) -> None:
    _state["events"].insert(0, event)
    del _state["events"][MAX_EVENTS:]


def run_pass() -> dict[str, Any]:
    """One full detect->fix pass. Called by the background loop and by /api/selfheal/run."""
    wls = cluster.workloads()
    baseline = cluster.baseline_dict()
    drift = detect_drift(wls, baseline)
    drifted = [d for d in drift if d["drifted"]]

    healed: list[str] = []
    failed: list[str] = []
    errors: list[dict[str, str]] = []

    for d in drifted:
        name = d["workload"]
        fields = [x["path"] for x in d["diffs"]]
        activity.log("heal.detect",
                     f"Self-heal detected drift in {name}: {', '.join(fields)} — restoring baseline",
                     workload=name, level="warn", details={"fields": fields})
        try:
            result = cluster.fix(name)
            ok = bool(result.get("verified"))
        except Exception as exc:  # keep watching; a heal failure must not kill the loop
            ok = False
            result = {"error": str(exc)[:300]}
            errors.append({"workload": name, "error": str(exc)[:300]})
        event = {
            "at": _now(),
            "workload": name,
            "verified": ok,
            "revertedFields": result.get("revertedFields", fields),
            "mode": result.get("clusterMode", cluster.mode()),
            "error": result.get("error") if not ok else None,
        }
        _record(event)
        if ok:
            healed.append(name)
            _state["healed"] += 1
            activity.log("heal.fixed",
                         f"Self-heal restored {name} to baseline — fingerprint verified, incident auto-resolved",
                         workload=name, level="success",
                         details={"revertedFields": event["revertedFields"]})
        else:
            failed.append(name)
            activity.log("heal.failed",
                         f"Self-heal could NOT restore {name}: {event['error'] or 'verification failed'}",
                         workload=name, level="error")

    _state["passes"] += 1
    _state["lastRunAt"] = _now()
    result = {
        "at": _state["lastRunAt"],
        "checked": len(wls),
        "drifted": [d["workload"] for d in drifted],
        "healed": healed,
        "failed": failed,
        "errors": errors,
    }
    _state["lastResult"] = result
    _state["driftFound"] = len(drifted)
    return {"healed": healed, "failed": failed, "status": status(), **result}


async def _loop() -> None:
    while True:
        try:
            await asyncio.sleep(max(3, int(_state["interval"])))
            if not _state["enabled"]:
                continue
            async with _lock:
                if cluster.mode() == "unavailable":
                    continue
                await asyncio.get_running_loop().run_in_executor(None, run_pass)
        except asyncio.CancelledError:
            raise
        except Exception:
            # The watcher must survive anything (e.g. cluster briefly unreachable).
            activity.log("selfheal.error", "Self-heal pass errored — watcher keeps running",
                         level="error")


async def start() -> None:
    global _task
    if _task is None or _task.done():
        _task = asyncio.create_task(_loop())


async def stop() -> None:
    global _task
    if _task and not _task.done():
        _task.cancel()
        try:
            await _task
        except asyncio.CancelledError:
            pass
    _task = None
