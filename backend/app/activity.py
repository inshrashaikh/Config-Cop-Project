"""In-memory activity feed — a plain-language timeline of everything the app did.

Every notable action (drift injected, scan completed, fix applied, self-heal pass,
scale change, pod delete) is recorded here so the UI can show a live, human-readable
"what happened and why" log. Ring buffer by design: demo-scale, no persistence.
"""
from __future__ import annotations

import threading
import time
from datetime import datetime, timezone
from typing import Any

_MAX = 200
_lock = threading.Lock()
_events: list[dict[str, Any]] = []
_seq = 0


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def log(kind: str, message: str, workload: str | None = None, level: str = "info",
        details: dict[str, Any] | None = None) -> dict[str, Any]:
    """Record one human-readable activity event. Returns the stored event."""
    global _seq
    with _lock:
        _seq += 1
        event = {
            "seq": _seq,
            "at": _now(),
            "ts": time.time(),
            "kind": kind,          # e.g. drift.inject, scan.complete, fix.apply, heal.pass, scale.change
            "level": level,        # info | warn | error | success
            "workload": workload,
            "message": message,    # plain language, shown as-is in the UI timeline
            "details": details or {},
        }
        _events.append(event)
        if len(_events) > _MAX:
            del _events[: len(_events) - _MAX]
        return event


def recent(limit: int = 50, workload: str | None = None) -> list[dict[str, Any]]:
    with _lock:
        items = list(_events)
    if workload:
        items = [e for e in items if e["workload"] == workload]
    items.sort(key=lambda e: -e["seq"])
    return items[: max(1, min(limit, _MAX))]


def clear() -> None:
    global _seq
    with _lock:
        _events.clear()
        _seq = 0
