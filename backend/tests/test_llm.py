"""Focused tests for the real OpenAI-compatible LLM integration (app/llm.py).

All network access is mocked. A real provider is only ever exercised by
scripts/verify_ai.py, which is run manually with a real key.
"""
from __future__ import annotations

import json
from typing import Any

import httpx
import pytest

from app import llm

DIFFS = [{"path": "replicas", "expected": 3, "actual": 1},
         {"path": "resources.limits.cpu", "expected": "500m", "actual": "100m"}]

AI_JSON = {
    "explanation": "The replica count dropped and CPU limits were lowered, reducing capacity.",
    "likely_cause": "A manual kubectl edit outside the deploy pipeline.",
    "risk": "Under heavy load the service may throttle or become unavailable.",
    "recommended_action": "Restore baseline values and re-scan to verify.",
}


# --------------------------------------------------------------------- fakes

class FakeResponse:
    def __init__(self, status_code: int = 200, payload: Any = None, text: str | None = None) -> None:
        self.status_code = status_code
        self._payload = payload
        self.text = text if text is not None else json.dumps(payload or {})

    def json(self) -> Any:
        return self._payload

    def raise_for_status(self) -> None:
        if self.status_code >= 400:
            request = httpx.Request("POST", "https://example.test/v1/chat/completions")
            response = httpx.Response(self.status_code, request=request, text=self.text)
            raise httpx.HTTPStatusError(f"HTTP {self.status_code}", request=request, response=response)


class FakeClient:
    """Stand-in for httpx.Client capturing the outgoing request."""

    def __init__(self, *, response: FakeResponse | None = None, exc: Exception | None = None,
                 capture: dict[str, Any] | None = None) -> None:
        self._response = response
        self._exc = exc
        self._capture = capture

    def __enter__(self) -> "FakeClient":
        return self

    def __exit__(self, *exc_info: Any) -> bool:
        return False

    def post(self, url: str, json: Any = None, headers: dict[str, str] | None = None) -> FakeResponse:
        if self._capture is not None:
            self._capture.update({"url": url, "payload": json, "headers": headers})
        if self._exc is not None:
            raise self._exc
        assert self._response is not None
        return self._response


def _patch_client(monkeypatch: pytest.MonkeyPatch, **kwargs: Any) -> dict[str, Any]:
    capture: dict[str, Any] = {}

    def factory(*_args: Any, **_kwargs: Any) -> FakeClient:
        return FakeClient(capture=capture, **kwargs)

    monkeypatch.setattr(llm.httpx, "Client", factory)
    return capture


def _content(text: str, status: int = 200) -> FakeResponse:
    return FakeResponse(status, payload={"choices": [{"message": {"content": text}}]})


def _configured(monkeypatch: pytest.MonkeyPatch, provider: str = "groq") -> None:
    monkeypatch.setenv("LLM_PROVIDER", provider)
    monkeypatch.setenv("LLM_MODEL", "llama-3.3-70b-versatile")
    monkeypatch.setenv("LLM_API_KEY", "gsk_test_key_not_real")


GEMINI_MODEL = "gemini-3.8-flash"
GEMINI_KEY = "AIzaSy_test_key_not_real"


def _gemini_content(text: str, status: int = 200) -> FakeResponse:
    """A response shaped like the Generative Language API's generateContent."""
    return FakeResponse(status, payload={"candidates": [{"content": {"parts": [{"text": text}]},
                                                           "finishReason": "STOP"}]})


def _configured_gemini(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("LLM_PROVIDER", "gemini")
    monkeypatch.setenv("LLM_MODEL", GEMINI_MODEL)
    monkeypatch.setenv("LLM_API_KEY", GEMINI_KEY)


# ---------------------------------------------------------------- provider_info

def test_disabled_by_default(monkeypatch: pytest.MonkeyPatch) -> None:
    info = llm.provider_info()
    assert info["enabled"] is False
    assert info["mode"] == "fallback"
    assert info["provider"] == "rule-based"


def test_groq_uses_default_base_url(monkeypatch: pytest.MonkeyPatch) -> None:
    _configured(monkeypatch)
    info = llm.provider_info()
    assert info["enabled"] is True
    assert info["provider"] == "groq"
    assert info["model"] == "llama-3.3-70b-versatile"
    assert info["baseUrl"] == "https://api.groq.com/openai/v1"
    assert info["hasKey"] is True
    assert info["missingKey"] is False


def test_base_url_override(monkeypatch: pytest.MonkeyPatch) -> None:
    _configured(monkeypatch)
    monkeypatch.setenv("LLM_BASE_URL", "https://gateway.internal/v1")
    assert llm.provider_info()["baseUrl"] == "https://gateway.internal/v1"


def test_missing_key_is_flagged(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("LLM_PROVIDER", "groq")
    monkeypatch.setenv("LLM_MODEL", "llama-3.3-70b-versatile")
    info = llm.provider_info()
    assert info["enabled"] is True
    assert info["hasKey"] is False
    assert info["missingKey"] is True
    assert info["keyRequired"] is True


def test_ollama_needs_no_key(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("LLM_PROVIDER", "ollama")
    monkeypatch.setenv("LLM_MODEL", "llama3.1:8b")
    info = llm.provider_info()
    assert info["enabled"] is True
    assert info["missingKey"] is False


def test_endpoint_and_auth_header(monkeypatch: pytest.MonkeyPatch) -> None:
    _configured(monkeypatch)
    monkeypatch.setenv("LLM_BASE_URL", "https://api.groq.com/openai/v1/")
    url, headers = llm._endpoint()
    assert url == "https://api.groq.com/openai/v1/chat/completions"
    assert headers["Authorization"] == "Bearer gsk_test_key_not_real"


def test_endpoint_ollama_omits_auth(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("LLM_PROVIDER", "ollama")
    monkeypatch.setenv("LLM_MODEL", "llama3.1:8b")
    _url, headers = llm._endpoint()
    assert "Authorization" not in headers


# ---------------------------------------------------------------- rule-based

def test_rule_based_always_labelled(monkeypatch: pytest.MonkeyPatch) -> None:
    out = llm.rule_based_explanation("checkout-api", DIFFS, ["checkout-api"])
    assert out["source"] == "rule-based"
    assert "checkout-api" in out["explanation"]
    assert "replicas" in out["explanation"]


# ---------------------------------------------------------------- explain: fallbacks

def test_explain_not_configured_uses_labelled_fallback(monkeypatch: pytest.MonkeyPatch) -> None:
    out = llm.explain("checkout-api", DIFFS, [])
    assert out["source"] == "rule-based"
    assert out["aiAttempted"] is False
    assert out["aiError"] is None


def test_explain_no_drift_skips_ai(monkeypatch: pytest.MonkeyPatch) -> None:
    _configured(monkeypatch)
    out = llm.explain("checkout-api", [], [])
    assert out["source"] == "rule-based"
    assert out["aiAttempted"] is False


def test_explain_missing_key_short_circuits(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("LLM_PROVIDER", "groq")
    monkeypatch.setenv("LLM_MODEL", "llama-3.3-70b-versatile")
    # no client patched: if a network call were attempted this would raise.
    out = llm.explain("checkout-api", DIFFS, [])
    assert out["source"] == "rule-based"
    assert out["aiAttempted"] is False
    assert "LLM_API_KEY" in out["aiError"]


# ---------------------------------------------------------------- explain: real call (mocked)

def test_explain_success_returns_ai_source(monkeypatch: pytest.MonkeyPatch) -> None:
    _configured(monkeypatch)
    capture = _patch_client(monkeypatch, response=_content(json.dumps(AI_JSON)))
    out = llm.explain("checkout-api", DIFFS, ["checkout-api"])
    assert out["source"] == "ai:groq/llama-3.3-70b-versatile"
    assert out["aiAttempted"] is True
    assert out["aiError"] is None
    assert out["aiPartial"] is False
    assert out["explanation"] == AI_JSON["explanation"]
    assert out["likelyCause"] == AI_JSON["likely_cause"]
    assert out["risk"] == AI_JSON["risk"]
    assert out["recommendedAction"] == AI_JSON["recommended_action"]
    # the request went to the right place with the key, server-side
    assert capture["url"] == "https://api.groq.com/openai/v1/chat/completions"
    assert capture["headers"]["Authorization"] == "Bearer gsk_test_key_not_real"
    assert "checkout-api" in json.dumps(capture["payload"])


def test_explain_accepts_fenced_json(monkeypatch: pytest.MonkeyPatch) -> None:
    _configured(monkeypatch)
    fenced = "```json\n" + json.dumps(AI_JSON) + "\n```"
    _patch_client(monkeypatch, response=_content(fenced))
    out = llm.explain("checkout-api", DIFFS, [])
    assert out["source"].startswith("ai:")


def test_explain_partial_response_is_flagged(monkeypatch: pytest.MonkeyPatch) -> None:
    _configured(monkeypatch)
    _patch_client(monkeypatch, response=_content(json.dumps({"explanation": "only text"})))
    out = llm.explain("checkout-api", DIFFS, [])
    assert out["source"].startswith("ai:")
    assert out["aiPartial"] is True
    assert set(out["aiPartialFields"]) == {"likelyCause", "risk", "recommendedAction"}
    # missing fields fall back to deterministic text, explanation stays AI
    assert out["explanation"] == "only text"
    assert out["risk"] == llm.rule_based_explanation("checkout-api", DIFFS, [])["risk"]


def test_explain_empty_explanation_is_not_labelled_ai(monkeypatch: pytest.MonkeyPatch) -> None:
    _configured(monkeypatch)
    _patch_client(monkeypatch, response=_content(json.dumps({"risk": "x"})))
    out = llm.explain("checkout-api", DIFFS, [])
    assert out["source"] == "rule-based"
    assert "explanation" in out["aiError"]


def test_explain_invalid_credentials(monkeypatch: pytest.MonkeyPatch) -> None:
    _configured(monkeypatch)
    _patch_client(monkeypatch, response=FakeResponse(401, payload={"error": "bad key"}))
    out = llm.explain("checkout-api", DIFFS, [])
    assert out["source"] == "rule-based"
    assert out["aiAttempted"] is True
    assert "authentication failed" in out["aiError"]
    assert "401" in out["aiError"]


def test_explain_rate_limited(monkeypatch: pytest.MonkeyPatch) -> None:
    _configured(monkeypatch)
    _patch_client(monkeypatch, response=FakeResponse(429, payload={"error": "slow down"}))
    out = llm.explain("checkout-api", DIFFS, [])
    assert out["source"] == "rule-based"
    assert "rate limited" in out["aiError"]


def test_explain_server_error_includes_status(monkeypatch: pytest.MonkeyPatch) -> None:
    _configured(monkeypatch)
    _patch_client(monkeypatch, response=FakeResponse(500, payload={"error": "boom"}))
    out = llm.explain("checkout-api", DIFFS, [])
    assert "HTTP 500" in out["aiError"]


def test_explain_timeout(monkeypatch: pytest.MonkeyPatch) -> None:
    _configured(monkeypatch)
    _patch_client(monkeypatch, exc=httpx.ReadTimeout("too slow"))
    out = llm.explain("checkout-api", DIFFS, [])
    assert out["source"] == "rule-based"
    assert "did not respond in time" in out["aiError"]


def test_explain_connection_error(monkeypatch: pytest.MonkeyPatch) -> None:
    _configured(monkeypatch)
    _patch_client(monkeypatch, exc=httpx.ConnectError("refused"))
    out = llm.explain("checkout-api", DIFFS, [])
    assert "cannot reach the API endpoint" in out["aiError"]


def test_explain_malformed_json(monkeypatch: pytest.MonkeyPatch) -> None:
    _configured(monkeypatch)
    _patch_client(monkeypatch, response=_content("not json at all"))
    out = llm.explain("checkout-api", DIFFS, [])
    assert out["source"] == "rule-based"
    assert "malformed JSON" in out["aiError"]


def test_explain_never_returns_the_key(monkeypatch: pytest.MonkeyPatch) -> None:
    _configured(monkeypatch)
    _patch_client(monkeypatch, response=_content(json.dumps(AI_JSON)))
    out = llm.explain("checkout-api", DIFFS, [])
    assert "gsk_test_key_not_real" not in json.dumps(out)


# ---------------------------------------------------------------- test_connection

def test_connection_disabled(monkeypatch: pytest.MonkeyPatch) -> None:
    result = llm.test_connection()
    assert result["ok"] is False
    assert result["mode"] == "disabled"


def test_connection_missing_key(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("LLM_PROVIDER", "groq")
    monkeypatch.setenv("LLM_MODEL", "llama-3.3-70b-versatile")
    result = llm.test_connection()
    assert result["ok"] is False
    assert result["mode"] == "error"
    assert result["errorType"] == "ConfigError"
    assert "LLM_API_KEY" in result["error"]


def test_connection_success(monkeypatch: pytest.MonkeyPatch) -> None:
    _configured(monkeypatch)
    _patch_client(monkeypatch, response=_content("ok"))
    result = llm.test_connection()
    assert result["ok"] is True
    assert result["mode"] == "connected"
    assert result["provider"] == "groq"
    assert result["sample"] == "ok"


def test_connection_error_classified(monkeypatch: pytest.MonkeyPatch) -> None:
    _configured(monkeypatch)
    _patch_client(monkeypatch, response=FakeResponse(401, payload={}))
    result = llm.test_connection()
    assert result["ok"] is False
    assert result["mode"] == "error"
    assert "authentication failed" in result["error"]


# ---------------------------------------------------------------- Gemini (Google Generative Language API)

def test_gemini_uses_default_base_url(monkeypatch: pytest.MonkeyPatch) -> None:
    _configured_gemini(monkeypatch)
    info = llm.provider_info()
    assert info["enabled"] is True
    assert info["provider"] == "gemini"
    assert info["model"] == GEMINI_MODEL
    assert info["baseUrl"] == "https://generativelanguage.googleapis.com/v1beta"
    assert info["hasKey"] is True
    assert info["missingKey"] is False
    assert info["keyRequired"] is True
    assert info["mode"] == "ai"


def test_gemini_requires_key(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("LLM_PROVIDER", "gemini")
    monkeypatch.setenv("LLM_MODEL", GEMINI_MODEL)
    info = llm.provider_info()
    assert info["enabled"] is True
    assert info["missingKey"] is True


def test_gemini_endpoint_and_header(monkeypatch: pytest.MonkeyPatch) -> None:
    _configured_gemini(monkeypatch)
    url, headers = llm._endpoint()
    # model + method live in the path; the key travels in a header, not the URL
    assert url == ("https://generativelanguage.googleapis.com/v1beta"
                   "/models/gemini-3.8-flash:generateContent")
    assert headers["x-goog-api-key"] == GEMINI_KEY
    assert "Authorization" not in headers
    assert GEMINI_KEY not in url


def test_gemini_base_url_override(monkeypatch: pytest.MonkeyPatch) -> None:
    _configured_gemini(monkeypatch)
    monkeypatch.setenv("LLM_BASE_URL", "https://gateway.internal/v1beta/")
    url, _headers = llm._endpoint()
    assert url == ("https://gateway.internal/v1beta"
                   "/models/gemini-3.8-flash:generateContent")


def test_explain_gemini_success(monkeypatch: pytest.MonkeyPatch) -> None:
    _configured_gemini(monkeypatch)
    capture = _patch_client(monkeypatch, response=_gemini_content(json.dumps(AI_JSON)))
    out = llm.explain("checkout-api", DIFFS, ["checkout-api"])
    assert out["source"] == f"ai:gemini/{GEMINI_MODEL}"
    assert out["aiAttempted"] is True
    assert out["aiError"] is None
    assert out["aiPartial"] is False
    # generated explanation parsed into the existing response format
    assert out["explanation"] == AI_JSON["explanation"]
    assert out["likelyCause"] == AI_JSON["likely_cause"]
    assert out["risk"] == AI_JSON["risk"]
    assert out["recommendedAction"] == AI_JSON["recommended_action"]
    # request shape is Gemini's, not OpenAI's
    assert capture["url"].endswith("/models/gemini-3.8-flash:generateContent")
    assert capture["headers"]["x-goog-api-key"] == GEMINI_KEY
    assert "Authorization" not in capture["headers"]
    payload = capture["payload"]
    assert "messages" not in payload
    assert "choices" not in json.dumps(payload)
    assert payload["generationConfig"]["responseMimeType"] == "application/json"
    assert "checkout-api" in json.dumps(payload)
    assert "temperature" not in payload["generationConfig"]


def test_explain_gemini_accepts_multiple_parts(monkeypatch: pytest.MonkeyPatch) -> None:
    _configured_gemini(monkeypatch)
    body = {"candidates": [{"content": {"parts": [{"text": "part one "},
                                                   {"text": json.dumps(AI_JSON)}]}}]}
    _patch_client(monkeypatch, response=FakeResponse(200, payload=body))
    out = llm.explain("checkout-api", DIFFS, [])
    assert out["source"].startswith("ai:gemini")
    assert out["explanation"] == AI_JSON["explanation"]


def test_explain_gemini_ignores_thinking_parts(monkeypatch: pytest.MonkeyPatch) -> None:
    _configured_gemini(monkeypatch)
    # Thinking parts ({"thought": true}) must not leak into the parsed answer.
    body = {"candidates": [{"content": {"parts": [
        {"text": "let me reason about this {not json}", "thought": True},
        {"text": json.dumps(AI_JSON)},
    ]}}]}
    _patch_client(monkeypatch, response=FakeResponse(200, payload=body))
    out = llm.explain("checkout-api", DIFFS, [])
    assert out["source"].startswith("ai:gemini")
    assert out["explanation"] == AI_JSON["explanation"]


def test_explain_gemini_partial_response_is_flagged(monkeypatch: pytest.MonkeyPatch) -> None:
    _configured_gemini(monkeypatch)
    _patch_client(monkeypatch, response=_gemini_content(json.dumps({"explanation": "only text"})))
    out = llm.explain("checkout-api", DIFFS, [])
    assert out["source"].startswith("ai:gemini")
    assert out["aiPartial"] is True
    assert set(out["aiPartialFields"]) == {"likelyCause", "risk", "recommendedAction"}


def test_explain_gemini_blocked_response_falls_back(monkeypatch: pytest.MonkeyPatch) -> None:
    _configured_gemini(monkeypatch)
    # A safety-blocked response has no candidate parts at all.
    _patch_client(monkeypatch, response=FakeResponse(
        200, payload={"promptFeedback": {"blockReason": "SAFETY"}}))
    out = llm.explain("checkout-api", DIFFS, [])
    assert out["source"] == "rule-based"
    assert out["aiAttempted"] is True
    assert "no text" in out["aiError"]


def test_explain_gemini_auth_error_400(monkeypatch: pytest.MonkeyPatch) -> None:
    _configured_gemini(monkeypatch)
    # Google reports an invalid key as HTTP 400 INVALID_ARGUMENT.
    _patch_client(monkeypatch, response=FakeResponse(
        400, payload={"error": {"code": 400, "status": "INVALID_ARGUMENT",
                                "message": "API key not valid. Please pass a valid API key."}},
        text=json.dumps({"error": {"code": 400, "status": "INVALID_ARGUMENT",
                                   "message": "API key not valid. Please pass a valid API key."}})))
    out = llm.explain("checkout-api", DIFFS, [])
    assert out["source"] == "rule-based"
    assert out["aiAttempted"] is True
    assert "authentication failed" in out["aiError"]
    assert "400" in out["aiError"]


def test_explain_gemini_forbidden(monkeypatch: pytest.MonkeyPatch) -> None:
    _configured_gemini(monkeypatch)
    _patch_client(monkeypatch, response=FakeResponse(403, payload={"error": "forbidden"}))
    out = llm.explain("checkout-api", DIFFS, [])
    assert "authentication failed" in out["aiError"]


def test_explain_gemini_rate_limited(monkeypatch: pytest.MonkeyPatch) -> None:
    _configured_gemini(monkeypatch)
    _patch_client(monkeypatch, response=FakeResponse(429, payload={"error": "quota exceeded"}))
    out = llm.explain("checkout-api", DIFFS, [])
    assert out["source"] == "rule-based"
    assert "rate limited" in out["aiError"]


def test_explain_gemini_temporarily_unavailable(monkeypatch: pytest.MonkeyPatch) -> None:
    _configured_gemini(monkeypatch)
    # Google returns 503 UNAVAILABLE when a model is in high demand.
    _patch_client(monkeypatch, response=FakeResponse(
        503, payload={"error": {"code": 503, "status": "UNAVAILABLE",
                                "message": "This model is currently experiencing high demand."}},
        text='{"error":{"code":503,"status":"UNAVAILABLE"}}'))
    out = llm.explain("checkout-api", DIFFS, [])
    assert out["source"] == "rule-based"
    assert out["aiAttempted"] is True
    assert "temporarily unavailable" in out["aiError"]
    assert "503" in out["aiError"]


def test_connection_gemini_server_error_classified(monkeypatch: pytest.MonkeyPatch) -> None:
    _configured_gemini(monkeypatch)
    _patch_client(monkeypatch, response=FakeResponse(
        500, payload={"error": "boom"}, text='{"error":"boom"}'))
    result = llm.test_connection()
    assert result["ok"] is False
    assert "server error" in result["error"] and "500" in result["error"]


def test_explain_gemini_timeout(monkeypatch: pytest.MonkeyPatch) -> None:
    _configured_gemini(monkeypatch)
    _patch_client(monkeypatch, exc=httpx.ReadTimeout("too slow"))
    out = llm.explain("checkout-api", DIFFS, [])
    assert out["source"] == "rule-based"
    assert "did not respond in time" in out["aiError"]


def test_explain_gemini_malformed_json(monkeypatch: pytest.MonkeyPatch) -> None:
    _configured_gemini(monkeypatch)
    _patch_client(monkeypatch, response=_gemini_content("this is not json"))
    out = llm.explain("checkout-api", DIFFS, [])
    assert out["source"] == "rule-based"
    assert "malformed JSON" in out["aiError"]


def test_explain_gemini_never_returns_the_key(monkeypatch: pytest.MonkeyPatch) -> None:
    _configured_gemini(monkeypatch)
    _patch_client(monkeypatch, response=_gemini_content(json.dumps(AI_JSON)))
    out = llm.explain("checkout-api", DIFFS, [])
    assert GEMINI_KEY not in json.dumps(out)


def test_connection_gemini_success(monkeypatch: pytest.MonkeyPatch) -> None:
    _configured_gemini(monkeypatch)
    capture = _patch_client(monkeypatch, response=_gemini_content("ok"))
    result = llm.test_connection()
    assert result["ok"] is True
    assert result["mode"] == "connected"
    assert result["provider"] == "gemini"
    assert result["sample"] == "ok"
    assert capture["url"].endswith("/models/gemini-3.8-flash:generateContent")
    # thinking models must not be starved of tokens by the ping cap
    assert "generationConfig" not in capture["payload"]


def test_connection_gemini_never_returns_the_key(monkeypatch: pytest.MonkeyPatch) -> None:
    _configured_gemini(monkeypatch)
    _patch_client(monkeypatch, response=FakeResponse(
        400, payload={"error": "API key not valid"}, text='{"error":"API key not valid"}'))
    result = llm.test_connection()
    assert result["ok"] is False
    assert GEMINI_KEY not in json.dumps(result)


# ---------------------------------------------------------------- _parse_json

def test_parse_json_plain_and_fenced_and_embedded() -> None:
    assert llm._parse_json('{"a": 1}') == {"a": 1}
    assert llm._parse_json('```json\n{"a": 1}\n```') == {"a": 1}
    assert llm._parse_json('here you go: {"a": 1} thanks') == {"a": 1}
