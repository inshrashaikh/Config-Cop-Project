"""API-level tests for the AI vs rule-based explanation contract.

These exercise the real FastAPI routes (no cluster: conftest forces
CLUSTER_MODE=simulated) while mocking the outbound LLM HTTP call.
"""
from __future__ import annotations

import json
from typing import Any

import httpx
import pytest
from fastapi.testclient import TestClient

from app import llm
from app.main import app

client = TestClient(app)

AI_JSON = {
    "explanation": "Replica count and CPU limit were lowered, cutting available capacity.",
    "likely_cause": "A manual kubectl edit outside the deploy pipeline.",
    "risk": "Traffic spikes may cause throttling or an outage.",
    "recommended_action": "Restore baseline values and re-scan to verify.",
}


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


class _Client:
    def __init__(self, response: _Resp) -> None:
        self._response = response

    def __enter__(self) -> "_Client":
        return self

    def __exit__(self, *exc: Any) -> bool:
        return False

    def post(self, *_a: Any, **_k: Any) -> _Resp:
        return self._response


def _mock_ai(monkeypatch: pytest.MonkeyPatch, response: _Resp | None = None) -> None:
    resp = response or _Resp(payload={"choices": [{"message": {"content": json.dumps(AI_JSON)}}]})
    monkeypatch.setattr(llm.httpx, "Client", lambda *a, **k: _Client(resp))


@pytest.fixture(autouse=True)
def _fresh_state() -> None:
    client.post("/api/reset")
    yield


def test_llm_status_disabled() -> None:
    body = client.get("/api/llm/status").json()
    assert body["mode"] == "fallback"
    assert body["test"] is None


def test_llm_test_disabled() -> None:
    body = client.post("/api/llm/test").json()
    assert body["ok"] is False
    assert body["mode"] == "disabled"


def test_scan_without_provider_is_labelled_rule_based() -> None:
    client.post("/api/drift/introduce", json={"count": 2})
    scan = client.post("/api/scan").json()
    assert scan["summary"]["drifted"], "expected drift after injection"
    explanations = scan["explanations"]
    assert explanations, "drifted workloads must have an explanation"
    for exp in explanations.values():
        assert exp["source"] == "rule-based"
        assert not exp["source"].startswith("ai:")


def test_scan_with_provider_returns_ai_explanations(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("LLM_PROVIDER", "groq")
    monkeypatch.setenv("LLM_MODEL", "llama-3.3-70b-versatile")
    monkeypatch.setenv("LLM_API_KEY", "gsk_test_key_not_real")
    _mock_ai(monkeypatch)

    client.post("/api/drift/introduce", json={"count": 2})
    scan = client.post("/api/scan").json()
    explanations = scan["explanations"]
    assert explanations
    for exp in explanations.values():
        assert exp["source"] == "ai:groq/llama-3.3-70b-versatile"
        assert exp["aiError"] is None
        assert exp["explanation"] == AI_JSON["explanation"]
    assert scan["summary"]["aiErrors"] == []


def test_scan_ai_failure_falls_back_and_reports_error(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("LLM_PROVIDER", "groq")
    monkeypatch.setenv("LLM_MODEL", "llama-3.3-70b-versatile")
    monkeypatch.setenv("LLM_API_KEY", "gsk_test_key_not_real")
    _mock_ai(monkeypatch, _Resp(401, {"error": "invalid api key"}))

    client.post("/api/drift/introduce", json={"count": 2})
    scan = client.post("/api/scan").json()
    for exp in scan["explanations"].values():
        assert exp["source"] == "rule-based"
        assert "authentication failed" in exp["aiError"]
    assert scan["summary"]["aiErrors"], "AI errors must be surfaced in the summary"


def test_llm_test_connected(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("LLM_PROVIDER", "groq")
    monkeypatch.setenv("LLM_MODEL", "llama-3.3-70b-versatile")
    monkeypatch.setenv("LLM_API_KEY", "gsk_test_key_not_real")
    _mock_ai(monkeypatch, _Resp(payload={"choices": [{"message": {"content": "ok"}}]}))
    body = client.post("/api/llm/test").json()
    assert body["ok"] is True
    assert body["mode"] == "connected"
    assert body["provider"] == "groq"
    # the key must never be echoed back to the client
    assert "gsk_test_key_not_real" not in json.dumps(body)


def test_llm_test_missing_key(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("LLM_PROVIDER", "groq")
    monkeypatch.setenv("LLM_MODEL", "llama-3.3-70b-versatile")
    body = client.post("/api/llm/test").json()
    assert body["ok"] is False
    assert body["errorType"] == "ConfigError"


def test_llm_test_gemini_connected(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("LLM_PROVIDER", "gemini")
    monkeypatch.setenv("LLM_MODEL", "gemini-3.8-flash")
    monkeypatch.setenv("LLM_API_KEY", "AIzaSy_test_key_not_real")
    _mock_ai(monkeypatch, _Resp(payload={"candidates": [{"content": {"parts": [{"text": "ok"}]}}]}))

    # provider status reports Gemini truthfully
    status = client.get("/api/llm/status").json()
    assert status["provider"] == "gemini"
    assert status["model"] == "gemini-3.8-flash"
    assert status["baseUrl"] == "https://generativelanguage.googleapis.com/v1beta"
    assert status["hasKey"] is True

    # the dashboard's "Test AI" path reports the real connection
    body = client.post("/api/llm/test").json()
    assert body["ok"] is True
    assert body["mode"] == "connected"
    assert body["provider"] == "gemini"
    assert body["sample"] == "ok"
    # the key must never be echoed back to the client
    assert "AIzaSy_test_key_not_real" not in json.dumps(body)
    assert "AIzaSy_test_key_not_real" not in json.dumps(status)
