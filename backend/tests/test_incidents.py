"""Focused tests for incident history, similarity retrieval and fix verification.

Everything runs against the throwaway SQLite DB created by ``conftest``
(``CONFIGCOP_DATA`` -> temp dir) and the explicitly-labelled simulated cluster
(``CLUSTER_MODE=simulated``). The live-fix tests monkeypatch ``app.k8s`` so no
test can ever touch a real Minikube/kubectl context.
"""
from __future__ import annotations

import copy
import json
import sqlite3
from typing import Any

import httpx
import pytest
from fastapi.testclient import TestClient

from app import cluster, incidents, k8s, llm, state
from app.main import app

client = TestClient(app)

LEGACY_SCHEMA = """
CREATE TABLE IF NOT EXISTS incidents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    workload TEXT NOT NULL,
    title TEXT NOT NULL,
    summary TEXT NOT NULL DEFAULT '',
    changes TEXT NOT NULL DEFAULT '[]',
    explanation TEXT NOT NULL DEFAULT '',
    likely_cause TEXT NOT NULL DEFAULT '',
    fix_applied TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'open',
    fingerprint TEXT NOT NULL DEFAULT '',
    baseline_fingerprint TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    resolved_at TEXT
);
"""

AI_JSON = {
    "explanation": "Replica count dropped and CPU limit was lowered, cutting capacity.",
    "likely_cause": "A manual kubectl edit outside the deploy pipeline.",
    "risk": "Traffic spikes may cause throttling or an outage.",
    "recommended_action": "Restore baseline values and re-scan to verify.",
}


@pytest.fixture(autouse=True)
def _clean_state() -> None:
    incidents.clear()
    state.reset_all()
    k8s.reset()
    yield
    incidents.clear()


# ------------------------------------------------------------------ helpers

class _Resp:
    def __init__(self, status_code: int = 200, payload: Any = None) -> None:
        self.status_code = status_code
        self._payload = payload
        self.text = json.dumps(payload or {})

    def json(self) -> Any:
        return self._payload

    def raise_for_status(self) -> None:
        if self.status_code >= 400:
            req = httpx.Request("POST", "https://example.test/v1/chat/completions")
            raise httpx.HTTPStatusError("err", request=req,
                                        response=httpx.Response(self.status_code, request=req, text=self.text))


class _AIClient:
    def __init__(self, resp: _Resp) -> None:
        self._resp = resp

    def __enter__(self) -> "_AIClient":
        return self

    def __exit__(self, *exc: Any) -> bool:
        return False

    def post(self, *_a: Any, **_k: Any) -> _Resp:
        return self._resp


def _mock_ai(monkeypatch: pytest.MonkeyPatch, content: str) -> None:
    resp = _Resp(payload={"choices": [{"message": {"content": content}}]})
    monkeypatch.setattr(llm.httpx, "Client", lambda *a, **k: _AIClient(resp))


def _drift_and_scan(c: TestClient, count: int = 1) -> dict[str, Any]:
    c.post("/api/drift/introduce", json={"count": count})
    return c.post("/api/scan").json()


# ------------------------------------------------------------------ migration

def test_migration_adds_explain_source_and_preserves_rows(tmp_path, monkeypatch) -> None:
    legacy = tmp_path / "legacy-incidents.db"
    conn = sqlite3.connect(legacy)
    conn.executescript(LEGACY_SCHEMA)
    conn.execute(
        "INSERT INTO incidents (workload, title, summary, changes, explanation, likely_cause, status, "
        "fingerprint, baseline_fingerprint, created_at) "
        "VALUES ('checkout-api','old title','old summary','[]','old exp','old cause','resolved','f','bf',"
        "'2020-01-01T00:00:00+00:00')"
    )
    conn.commit()
    conn.close()

    monkeypatch.setattr(incidents, "DB_PATH", legacy)
    incidents.init()  # CREATE TABLE IF NOT EXISTS is a no-op, then migration runs

    with incidents._conn() as c:
        cols = {r[1] for r in c.execute("PRAGMA table_info(incidents)")}
    assert "explain_source" in cols

    rows = incidents.list_incidents()
    assert len(rows) == 1, "existing records must be preserved by the migration"
    assert rows[0]["workload"] == "checkout-api"
    assert rows[0]["explanation"] == "old exp"
    assert rows[0]["explain_source"] == ""  # backfilled to the safe default

    incidents.init()  # idempotent: running migration twice must not fail or duplicate


# ------------------------------------------------------------------ persistence

def test_create_incident_persists_explain_source_and_fields() -> None:
    inc_id = incidents.create_incident(
        "checkout-api",
        [{"path": "replicas", "expected": 3, "actual": 1}],
        explanation="exp", likely_cause="cause", fingerprint="f", baseline_fingerprint="bf",
        explain_source="ai:groq/llama-3.3-70b-versatile",
    )
    row = next(i for i in incidents.list_incidents() if i["id"] == inc_id)
    assert row["explain_source"] == "ai:groq/llama-3.3-70b-versatile"
    assert row["workload"] == "checkout-api"
    assert row["changes"] == [{"path": "replicas", "expected": 3, "actual": 1}]
    assert row["status"] == "open"
    assert row["created_at"]
    assert row["resolved_at"] is None


def test_scan_persists_rule_based_explain_source() -> None:
    scan = _drift_and_scan(client)
    assert scan["summary"]["drifted"]
    opens = [i for i in client.get("/api/incidents").json()["incidents"] if i["status"] == "open"]
    assert opens
    for i in opens:
        assert i["explain_source"] == "rule-based"


def test_scan_persists_ai_explain_source(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("LLM_PROVIDER", "groq")
    monkeypatch.setenv("LLM_MODEL", "llama-3.3-70b-versatile")
    monkeypatch.setenv("LLM_API_KEY", "gsk_test_key_not_real")
    _mock_ai(monkeypatch, json.dumps(AI_JSON))

    _drift_and_scan(client)
    opens = [i for i in client.get("/api/incidents").json()["incidents"] if i["status"] == "open"]
    assert opens
    for i in opens:
        assert i["explain_source"] == "ai:groq/llama-3.3-70b-versatile"
        assert "gsk_test_key_not_real" not in json.dumps(i)


def test_refresh_updates_source_without_resolving() -> None:
    inc_id = incidents.create_incident(
        "checkout-api", [{"path": "replicas", "expected": 3, "actual": 1}],
        explanation="old", likely_cause="cause", fingerprint="f", baseline_fingerprint="bf",
        explain_source="rule-based",
    )
    before = next(i for i in incidents.list_incidents() if i["id"] == inc_id)
    incidents.refresh_incident(
        inc_id, workload="checkout-api", explanation="new", explain_source="ai:groq/llama-3.3-70b-versatile",
        likely_cause="new cause", changes=[{"path": "replicas", "expected": 3, "actual": 2}],
        fingerprint="f2", baseline_fingerprint="bf",
    )
    after = next(i for i in incidents.list_incidents() if i["id"] == inc_id)
    assert after["explanation"] == "new"
    assert after["explain_source"] == "ai:groq/llama-3.3-70b-versatile"
    assert after["status"] == "open"
    assert after["resolved_at"] is None
    assert after["created_at"] == before["created_at"]


# ------------------------------------------------------------------ duplicates

def test_duplicate_scan_reuses_open_incident() -> None:
    first = _drift_and_scan(client)
    assert first["summary"]["newIncidents"]
    open_ids_1 = {i["id"] for i in first["incidents"] if i["status"] == "open"}

    second = client.post("/api/scan").json()
    assert second["summary"]["newIncidents"] == [], "a repeat scan must not create duplicates"
    open_ids_2 = {i["id"] for i in second["incidents"] if i["status"] == "open"}
    assert open_ids_1 == open_ids_2


# ------------------------------------------------------------------ resolution

def test_successful_fix_resolves_and_history_is_retrievable() -> None:
    scan = _drift_and_scan(client)
    workload = scan["summary"]["drifted"][0]

    fix = client.post("/api/fix", json={"workload": workload}).json()
    assert fix["verified"] is True
    assert fix["resolvedIncidents"], "verified fix must resolve the open incident(s)"
    assert fix["failedIncidents"] == []

    resolved = [i for i in incidents.list_incidents()
                if i["workload"] == workload and i["status"] == "resolved"]
    assert resolved and resolved[0]["fix_applied"]

    # re-introduce similar drift -> the past verified fix is retrieved
    client.post("/api/drift/introduce", json={"workload": workload, "count": 1})
    rescan = client.post("/api/scan").json()
    matches = rescan["matchedIncidents"].get(workload, [])
    assert matches, "resolved incidents with a verified fix must be retrievable"
    for m in matches:
        assert m["status"] == "resolved"
        assert m["fix_applied"]
        assert m["historical"] is True
        assert m["suggestedFix"] == m["fix_applied"]


def test_failed_fix_never_resolves_or_becomes_recommendation(monkeypatch: pytest.MonkeyPatch) -> None:
    name = "checkout-api"
    baseline_cfg = copy.deepcopy(state.get_baseline()[name])
    drifted = copy.deepcopy(baseline_cfg)
    drifted["replicas"] = 1  # differs from baseline, and the mocked patch never converges

    inc_id = incidents.create_incident(
        name, [{"path": "replicas", "expected": baseline_cfg["replicas"], "actual": 1}],
        explanation="exp", likely_cause="cause",
        fingerprint=state.fingerprint(drifted), baseline_fingerprint=state.fingerprint(baseline_cfg),
        explain_source="rule-based",
    )

    # Force the LIVE path, but with kubectl fully stubbed: apply_config is a no-op
    # so verification (get_config after patch) can never match the baseline.
    monkeypatch.setattr(k8s, "status", lambda: {
        "mode": "live", "available": True, "context": "test-context", "namespace": "prod",
        "detail": "test", "live": True,
    })
    monkeypatch.setattr(k8s, "get_config", lambda n: copy.deepcopy(drifted))
    monkeypatch.setattr(k8s, "apply_config", lambda n, cfg: {"patched": True})
    monkeypatch.setattr(k8s, "wait_rollout", lambda n, timeout="45s": {"ok": True, "status": "Complete"})
    monkeypatch.setattr(k8s, "live_workloads", lambda: [{
        "name": name, "namespace": "prod", "config": copy.deepcopy(drifted),
        "fingerprint": state.fingerprint(drifted),
    }])
    monkeypatch.setattr(cluster, "baseline", lambda: {name: copy.deepcopy(baseline_cfg)})

    result = client.post("/api/fix", json={"workload": name}).json()
    assert result["verified"] is False
    assert result["resolvedIncidents"] == []
    assert result["failedIncidents"] == [inc_id]

    row = next(i for i in incidents.list_incidents() if i["id"] == inc_id)
    assert row["status"] != "resolved", "a failed fix must never resolve the incident"
    assert row["resolved_at"] is None
    assert "NOT verified" in row["fix_applied"]

    # A failed/unresolved incident must never be surfaced as a verified recommendation.
    assert incidents.match_similar([{"path": "replicas"}], name) == []


def test_match_similar_only_returns_resolved_with_applied_fix() -> None:
    open_id = incidents.create_incident(
        "checkout-api", [{"path": "replicas", "expected": 3, "actual": 1}],
        "exp", "cause", "f", "bf", explain_source="rule-based",
    )
    # open incident -> excluded
    assert incidents.match_similar([{"path": "replicas"}], "checkout-api") == []

    incidents.resolve_incidents("checkout-api", "restore baseline")
    matches = incidents.match_similar([{"path": "replicas"}], "checkout-api")
    assert [m["id"] for m in matches] == [open_id]
    assert matches[0]["fix_applied"] == "restore baseline"
    assert matches[0]["historical"] is True

    # resolved but with NO recorded fix -> still excluded (not a verified fix)
    incidents.clear()
    incidents.create_incident("checkout-api", [{"path": "replicas", "expected": 3, "actual": 1}],
                              "exp", "cause", "f", "bf")
    incidents.resolve_incidents("checkout-api", "")
    assert incidents.match_similar([{"path": "replicas"}], "checkout-api") == []

    # failed fix -> excluded
    incidents.clear()
    failed_id = incidents.create_incident("checkout-api", [{"path": "replicas", "expected": 3, "actual": 1}],
                                          "exp", "cause", "f", "bf")
    incidents.mark_fix_failed("checkout-api", "Fix NOT verified")
    rows = incidents.list_incidents()
    assert next(r for r in rows if r["id"] == failed_id)["status"] == "failed"
    assert incidents.match_similar([{"path": "replicas"}], "checkout-api") == []
