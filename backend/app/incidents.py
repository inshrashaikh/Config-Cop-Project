"""Incident history in SQLite + similarity matching for recurring problems.

Lightweight by design: one table, stdlib sqlite3, TF-IDF/cosine via scikit-learn.
"""
from __future__ import annotations

import json
import os
import re
import sqlite3
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

DATA_DIR = Path(os.environ.get("CONFIGCOP_DATA", Path(__file__).resolve().parents[1] / "data"))
DATA_DIR.mkdir(parents=True, exist_ok=True)
DB_PATH = DATA_DIR / "incidents.db"

_lock = threading.Lock()

_SCHEMA = """
CREATE TABLE IF NOT EXISTS incidents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    workload TEXT NOT NULL,
    title TEXT NOT NULL,
    summary TEXT NOT NULL DEFAULT '',
    changes TEXT NOT NULL DEFAULT '[]',
    explanation TEXT NOT NULL DEFAULT '',
    explain_source TEXT NOT NULL DEFAULT '',
    likely_cause TEXT NOT NULL DEFAULT '',
    fix_applied TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'open',
    fingerprint TEXT NOT NULL DEFAULT '',
    baseline_fingerprint TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    resolved_at TEXT
);
"""


def _conn() -> sqlite3.Connection:
    c = sqlite3.connect(DB_PATH)
    c.row_factory = sqlite3.Row
    return c


def _migrate(c: sqlite3.Connection) -> None:
    """Add missing columns to a pre-existing table without touching rows.

    Old databases were created before ``explain_source`` existed; ALTER TABLE
    ADD COLUMN with a constant DEFAULT is a no-op on the data itself, so every
    existing record is preserved verbatim.
    """
    cols = {row[1] for row in c.execute("PRAGMA table_info(incidents)")}
    if "explain_source" not in cols:
        c.execute("ALTER TABLE incidents ADD COLUMN explain_source TEXT NOT NULL DEFAULT ''")


def init() -> None:
    with _lock, _conn() as c:
        c.executescript(_SCHEMA)
        _migrate(c)


init()


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def create_incident(
    workload: str,
    changes: list[dict[str, Any]],
    explanation: str,
    likely_cause: str,
    fingerprint: str,
    baseline_fingerprint: str,
    explain_source: str = "",
) -> int:
    paths = ", ".join(d["path"] for d in changes) or "config"
    title = f"{workload}: {paths} drifted from baseline"
    summary = f"{len(changes)} field(s) changed: {paths}"
    with _lock, _conn() as c:
        cur = c.execute(
            "INSERT INTO incidents (workload, title, summary, changes, explanation, explain_source, "
            "likely_cause, status, fingerprint, baseline_fingerprint, created_at) "
            "VALUES (?,?,?,?,?,?,?, 'open', ?,?,?)",
            (workload, title, summary, json.dumps(changes), explanation, explain_source, likely_cause,
             fingerprint, baseline_fingerprint, _now()),
        )
        return int(cur.lastrowid)


def refresh_incident(
    incident_id: int,
    workload: str,
    explanation: str,
    explain_source: str,
    likely_cause: str,
    changes: list[dict[str, Any]],
    fingerprint: str,
    baseline_fingerprint: str,
) -> None:
    """Update an existing open incident with the latest explanation/source/diff.

    Keeps created_at (first observation) and never changes status, so an
    unresolved incident is not marked resolved prematurely.
    """
    paths = ", ".join(d["path"] for d in changes) or "config"
    title = f"{workload}: {paths} drifted from baseline"
    summary = f"{len(changes)} field(s) changed: {paths}"
    with _lock, _conn() as c:
        c.execute(
            "UPDATE incidents SET changes=?, explanation=?, explain_source=?, likely_cause=?, "
            "fingerprint=?, baseline_fingerprint=?, title=?, summary=? WHERE id=? AND status='open'",
            (json.dumps(changes), explanation, explain_source, likely_cause, fingerprint,
             baseline_fingerprint, title, summary, incident_id),
        )


def open_incident_for(workload: str, paths: set[str]) -> sqlite3.Row | None:
    """Existing open incident covering these changed paths (avoid duplicates)."""
    with _conn() as c:
        rows = c.execute("SELECT * FROM incidents WHERE workload=? AND status='open' ORDER BY id DESC",
                         (workload,)).fetchall()
    for r in rows:
        try:
            prev = {d["path"] for d in json.loads(r["changes"])}
        except json.JSONDecodeError:
            prev = set()
        if prev == paths or (paths and paths.issubset(prev)):
            return r
    return None


def resolve_incidents(workload: str, fix_applied: str, incident_ids: list[int] | None = None) -> list[dict[str, Any]]:
    """Mark open incidents for this workload as resolved (successful, verified fix only).

    Only call this AFTER the fix has been verified against the baseline; a failed
    fix must use ``mark_fix_failed`` so the incident stays open / never becomes a
    "verified historical" recommendation.
    """
    with _lock, _conn() as c:
        if incident_ids:
            placeholders = ",".join("?" * len(incident_ids))
            rows = c.execute(
                f"SELECT * FROM incidents WHERE workload=? AND status='open' AND id IN ({placeholders})",
                (workload, *incident_ids),
            ).fetchall()
        else:
            rows = c.execute("SELECT * FROM incidents WHERE workload=? AND status='open'", (workload,)).fetchall()
        ids = [r["id"] for r in rows]
        if ids:
            c.execute(
                f"UPDATE incidents SET status='resolved', resolved_at=?, fix_applied=? "
                f"WHERE id IN ({','.join('?' * len(ids))})",
                (_now(), fix_applied, *ids),
            )
    return [dict(r) for r in rows]


def mark_fix_failed(workload: str, detail: str, incident_ids: list[int] | None = None) -> list[dict[str, Any]]:
    """Record a failed fix attempt without resolving the incident.

    Sets status='failed' (still not 'resolved') and stores the failure detail so
    it is visible in history but never counts as a verified historical fix.
    """
    with _lock, _conn() as c:
        if incident_ids:
            placeholders = ",".join("?" * len(incident_ids))
            rows = c.execute(
                f"SELECT * FROM incidents WHERE workload=? AND status='open' AND id IN ({placeholders})",
                (workload, *incident_ids),
            ).fetchall()
        else:
            rows = c.execute("SELECT * FROM incidents WHERE workload=? AND status='open'", (workload,)).fetchall()
        ids = [r["id"] for r in rows]
        if ids:
            c.execute(
                f"UPDATE incidents SET status='failed', fix_applied=? "
                f"WHERE id IN ({','.join('?' * len(ids))})",
                (detail, *ids),
            )
    return [dict(r) for r in rows]


def list_incidents(limit: int = 50) -> list[dict[str, Any]]:
    with _conn() as c:
        rows = c.execute("SELECT * FROM incidents ORDER BY id DESC LIMIT ?", (limit,)).fetchall()
    return [_row(r) for r in rows]


def _row(r: sqlite3.Row) -> dict[str, Any]:
    d = dict(r)
    d["changes"] = json.loads(d.get("changes") or "[]")
    return d


def clear() -> None:
    with _lock, _conn() as c:
        c.execute("DELETE FROM incidents")


# ---------------------------------------------------------------- similarity

def _text(inc: dict[str, Any]) -> str:
    paths = " ".join(d.get("path", "") for d in inc.get("changes", []))
    tokens = re.sub(r"[^a-z0-9_.]+", " ", (inc.get("explanation", "") + " " + inc.get("likely_cause", "")).lower())
    return f"{inc['workload']} {paths} {tokens}"


def match_similar(changes: list[dict[str, Any]], workload: str, top_k: int = 3) -> list[dict[str, Any]]:
    """Find past incidents resembling the current drift (TF-IDF + cosine similarity).

    Only resolved incidents that actually recorded a verified fix
    (``fix_applied`` non-empty) are eligible; failed/unresolved incidents never
    become a recommendation.
    """
    past = [i for i in list_incidents(200) if i["status"] == "resolved" and (i.get("fix_applied") or "").strip()]
    if not past:
        return []

    query_paths = {d["path"] for d in changes}
    corpus = [_text(i) for i in past]

    scored: list[dict[str, Any]] = []
    try:
        from sklearn.feature_extraction.text import TfidfVectorizer
        from sklearn.metrics.pairwise import cosine_similarity

        vectorizer = TfidfVectorizer(stop_words="english")
        mat = vectorizer.fit_transform(corpus + [" ".join(sorted(query_paths)) + " " + workload])
        sims = cosine_similarity(mat[-1:], mat[:-1])[0]
        for inc, sim in zip(past, sims):
            scored.append((float(sim), inc))
    except Exception:
        # rule-based fallback: same workload + overlapping changed paths
        for inc in past:
            inc_paths = {d["path"] for d in inc.get("changes", [])}
            overlap = len(query_paths & inc_paths)
            union = len(query_paths | inc_paths) or 1
            sim = (0.5 if inc["workload"] == workload else 0.0) + 0.5 * (overlap / union)
            scored.append((sim, inc))

    scored = [(s, i) for s, i in scored if s >= 0.15]
    scored.sort(key=lambda t: -t[0])
    out = []
    for sim, inc in scored[:top_k]:
        out.append({
            **inc,
            "similarity": round(sim, 3),
            "match": True,
            # Historical suggestion (what was applied and verified in the past),
            # not a guaranteed fix for the current drift.
            "suggestedFix": inc.get("fix_applied", ""),
            "historical": True,
        })
    return out
