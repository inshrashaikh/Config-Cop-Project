"""Plain-language drift explanations.

Provider is configurable via env. OpenAI-compatible providers use
``/chat/completions``; Google Gemini uses its official Generative Language API
(``models/{model}:generateContent``):
  LLM_PROVIDER = openai | groq | openrouter | together | gemini | ollama | custom | none
  LLM_BASE_URL, LLM_MODEL, LLM_API_KEY (server-side only, never sent to the browser)

Any failure or timeout falls back to the deterministic rule-based explainer.
The AI only produces TEXT (explanation + cause + risk). The actual fix is always
computed server-side from the baseline diff — the model never issues commands.
"""
from __future__ import annotations

import json
import os
import time
from typing import Any

import httpx

DEFAULT_BASE_URLS = {
    "openai": "https://api.openai.com/v1",
    "groq": "https://api.groq.com/openai/v1",
    "openrouter": "https://openrouter.ai/api/v1",
    "together": "https://api.together.xyz/v1",
    # Google's official Gemini API (Generative Language API). Model + method
    # are part of the URL path, so the base is the versioned API root.
    "gemini": "https://generativelanguage.googleapis.com/v1beta",
    "ollama": "http://localhost:11434/v1",
    "custom": "http://localhost:8000/v1",
}

# Cloud providers that require an API key. Local/custom endpoints may not.
KEY_REQUIRED = {"openai", "groq", "openrouter", "together", "gemini"}

GEMINI_PROVIDER = "gemini"

RISK_HINTS = {
    "resources.limits": "Reduced/expanded CPU-memory limits can cause throttling, OOM kills, or node pressure.",
    "resources.requests": "Request changes alter scheduling and can evict or starve other pods.",
    "replicas": "Replica changes affect availability and capacity during traffic spikes.",
    "image": "An image change ships unreviewed code/config into production.",
    "env.": "Environment changes alter runtime behaviour without a deploy.",
    "probes": "Probe changes can make Kubernetes restart healthy pods or keep broken pods in rotation.",
}


def provider_info() -> dict[str, Any]:
    provider = os.environ.get("LLM_PROVIDER", "none").strip().lower()
    model = os.environ.get("LLM_MODEL", "").strip()
    has_key = bool(os.environ.get("LLM_API_KEY", "").strip())
    enabled = provider not in ("", "none", "rule") and bool(model)
    if provider in DEFAULT_BASE_URLS and not os.environ.get("LLM_BASE_URL"):
        base = DEFAULT_BASE_URLS[provider]
    else:
        base = os.environ.get("LLM_BASE_URL", "")
    if provider == "ollama":
        enabled = bool(model)  # no key needed locally
    missing_key = bool(enabled and provider in KEY_REQUIRED and not has_key)
    return {
        "provider": provider if enabled else "rule-based",
        "model": model or None,
        "baseUrl": base or None,
        "enabled": enabled,
        "hasKey": has_key,
        "keyRequired": provider in KEY_REQUIRED,
        "missingKey": missing_key,
        "mode": "ai" if enabled else "fallback",
    }


def _preflight(info: dict[str, Any]) -> str | None:
    """Config problems detectable without a network call (never returns secrets)."""
    if not info["enabled"]:
        return None
    if info["missingKey"]:
        return (f"LLM_API_KEY is not set for provider '{info['provider']}' — "
                "export it or put it in .env (server-side only)")
    if not info["baseUrl"]:
        return (f"no API base URL configured for provider '{info['provider']}' — "
                "set LLM_BASE_URL to the OpenAI-compatible /v1 endpoint")
    return None


def rule_based_explanation(workload: str, diffs: list[dict[str, Any]], outliers: list[dict[str, Any]]) -> dict[str, str]:
    if not diffs:
        return {
            "explanation": f"{workload} matches its recorded baseline — no drift detected.",
            "likelyCause": "No change since the baseline fingerprint was captured.",
            "risk": "None.",
            "recommendedAction": "No action needed.",
            "source": "rule-based",
        }
    parts = [f"{d['path']} changed from {d['expected']!r} to {d['actual']!r}" for d in diffs]
    risk = next((v for k, v in RISK_HINTS.items() if any(d["path"].startswith(k) for d in diffs)),
                "Undocumented configuration change in production.")
    outlier_note = ""
    if outliers:
        outlier_note = f" IsolationForest also flags {', '.join(outliers)} as statistically unusual among these workloads."
    return {
        "explanation": ("Drift detected in " + workload + ": " + "; ".join(parts) + "."
                        + outlier_note),
        "likelyCause": "A manual change outside the deploy pipeline (e.g. kubectl edit/set image) "
                       "or an unreviewed manifest update diverged from the baseline.",
        "risk": risk,
        "recommendedAction": f"Restore the baseline values for {len(diffs)} field(s) and re-scan to verify "
                             "the fingerprint matches again.",
        "source": "rule-based",
    }


_PROMPT = """You are a Kubernetes configuration drift analyst for the demo tool Config Cop.
Given a workload and the exact fields that drifted from its baseline, reply with STRICT JSON:
{{"explanation": "<2-3 plain sentences: what changed and why it matters>",
  "likely_cause": "<what most likely caused this>",
  "risk": "<the potential operational impact if this is left unfixed>",
  "recommended_action": "<one safe remediation; only 'restore baseline values' is allowed as a fix>"}}
Rules: never suggest running commands, never invent fields, only use the data provided.

Workload: {workload}
Drifted fields (expected -> actual):
{diffs}
Isolation-forest outlier flags: {outliers}
"""


def _endpoint() -> tuple[str, dict[str, str]]:
    info = provider_info()
    base = (info["baseUrl"] or "").rstrip("/")
    headers = {"Content-Type": "application/json"}
    key = os.environ.get("LLM_API_KEY", "").strip()
    if info["provider"] == GEMINI_PROVIDER:
        # Gemini: the key travels in a header (never the URL), and both the
        # model and the method are part of the path.
        if key:
            headers["x-goog-api-key"] = key
        return f"{base}/models/{info['model']}:generateContent", headers
    url = f"{base}/chat/completions"
    if key and info["provider"] != "ollama":
        headers["Authorization"] = f"Bearer {key}"
    return url, headers


def _build_payload(info: dict[str, Any], user_text: str, *, system: str | None = None,
                   max_tokens: int | None = None, temperature: float = 0.2,
                   json_mode: bool = False) -> dict[str, Any]:
    """Build the provider-specific request body.

    Gemini uses ``contents`` / ``systemInstruction`` / ``generationConfig``;
    every other provider speaks the OpenAI ``messages`` schema.
    """
    if info["provider"] == GEMINI_PROVIDER:
        payload: dict[str, Any] = {"contents": [{"role": "user", "parts": [{"text": user_text}]}]}
        if system:
            payload["systemInstruction"] = {"parts": [{"text": system}]}
        generation: dict[str, Any] = {}
        if max_tokens:
            generation["maxOutputTokens"] = max_tokens
        if json_mode:
            generation["responseMimeType"] = "application/json"
        if generation:
            payload["generationConfig"] = generation
        return payload
    messages = ([{"role": "system", "content": system}] if system else []) + \
               [{"role": "user", "content": user_text}]
    payload = {"model": info["model"], "temperature": temperature, "messages": messages}
    if max_tokens:
        payload["max_tokens"] = max_tokens
    return payload


def _extract_text(info: dict[str, Any], body: Any) -> str:
    """Pull the generated text out of either API's response shape."""
    if info["provider"] == GEMINI_PROVIDER:
        try:
            parts = body["candidates"][0]["content"]["parts"]
            # Skip any "thinking" parts so only the final answer text is used.
            text = "".join(str(p.get("text", "")) for p in parts
                           if isinstance(p, dict) and not p.get("thought")).strip()
        except (KeyError, IndexError, TypeError) as exc:
            raise ValueError("the model returned no text (response blocked or empty)") from exc
        if not text:
            raise ValueError("the model returned no text (response blocked or empty)")
        return text
    return str(body["choices"][0]["message"]["content"]).strip()


def _classify(exc: Exception) -> str:
    if isinstance(exc, httpx.ConnectError):
        return "cannot reach the API endpoint (connection refused/DNS)"
    if isinstance(exc, httpx.ConnectTimeout):
        return "connection timed out"
    if isinstance(exc, httpx.ReadTimeout):
        return "the API did not respond in time"
    if isinstance(exc, httpx.HTTPStatusError):
        code = exc.response.status_code
        body = ""
        try:
            body = exc.response.text[:200]
        except Exception:
            pass
        if code in (401, 403):
            return f"authentication failed (HTTP {code}) — check LLM_API_KEY"
        if code == 400 and "api key" in body.lower():
            # Google returns 400 INVALID_ARGUMENT (not 401) for a bad key.
            return "authentication failed (HTTP 400) — check LLM_API_KEY"
        if code == 404:
            return f"endpoint/model not found (HTTP 404) — check LLM_BASE_URL and LLM_MODEL"
        if code == 429:
            return "rate limited (HTTP 429)"
        if code == 503:
            return ("the model is temporarily unavailable (HTTP 503, high demand) — "
                    "try again shortly or pick another LLM_MODEL")
        if code >= 500:
            return f"the provider returned a server error (HTTP {code}) — try again shortly"
        return f"API error HTTP {code}{(': ' + body) if body else ''}"
    if isinstance(exc, json.JSONDecodeError):
        return "the API returned malformed JSON"
    if isinstance(exc, ValueError):
        return str(exc) or "the API returned an unusable response"
    return f"{type(exc).__name__}: {exc}"


def _disabled_result() -> dict[str, Any]:
    return {
        "ok": False,
        "configured": False,
        "mode": "disabled",
        "provider": None,
        "model": None,
        "error": "No AI provider configured (set LLM_PROVIDER, LLM_MODEL, LLM_API_KEY). "
                 "Explanations use the rule-based fallback — not AI.",
        "checkedAt": _now(),
    }


def test_connection() -> dict[str, Any]:
    """Perform a REAL request to verify the LLM API is reachable and answering."""
    info = provider_info()
    if not info["enabled"]:
        return _disabled_result()
    problem = _preflight(info)
    if problem:
        return {
            "ok": False,
            "configured": True,
            "mode": "error",
            "provider": info["provider"],
            "model": info["model"],
            "baseUrl": info["baseUrl"],
            "latencyMs": 0,
            "error": problem,
            "errorType": "ConfigError",
            "missingKey": info["missingKey"],
            "checkedAt": _now(),
        }
    url, headers = _endpoint()
    # Gemini thinking models can spend a tiny token budget on reasoning, so the
    # connectivity ping leaves the budget to the provider; OpenAI-compatible
    # providers keep the cheap 16-token cap.
    ping_tokens = None if info["provider"] == GEMINI_PROVIDER else 16
    payload = _build_payload(info, "Reply with the single word: ok",
                             max_tokens=ping_tokens, temperature=0)
    t0 = time.time()
    try:
        with httpx.Client(timeout=float(os.environ.get("LLM_TIMEOUT", "12"))) as client:
            r = client.post(url, json=payload, headers=headers)
            r.raise_for_status()
            body = r.json()
            text = _extract_text(info, body)
        return {
            "ok": True,
            "configured": True,
            "mode": "connected",
            "provider": info["provider"],
            "model": info["model"],
            "baseUrl": info["baseUrl"],
            "latencyMs": int((time.time() - t0) * 1000),
            "sample": text[:80],
            "error": None,
            "checkedAt": _now(),
        }
    except Exception as exc:
        return {
            "ok": False,
            "configured": True,
            "mode": "error",
            "provider": info["provider"],
            "model": info["model"],
            "baseUrl": info["baseUrl"],
            "latencyMs": int((time.time() - t0) * 1000),
            "error": _classify(exc),
            "errorType": type(exc).__name__,
            "checkedAt": _now(),
        }


def _now() -> str:
    import datetime
    return datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds")


def explain(workload: str, diffs: list[dict[str, Any]], outliers: list[str]) -> dict[str, Any]:
    info = provider_info()
    fb = rule_based_explanation(workload, diffs, outliers)

    if not info["enabled"]:
        return {**fb, "aiAttempted": False, "aiError": None, "aiPartial": False,
                "aiStatus": "not configured (rule-based fallback)"}
    if not diffs:
        return {**fb, "aiAttempted": False, "aiError": None, "aiPartial": False,
                "aiStatus": "no drift to explain"}
    problem = _preflight(info)
    if problem:
        return {**fb, "source": "rule-based", "aiAttempted": False, "aiError": problem,
                "errorType": "ConfigError", "aiPartial": False, "aiStatus": f"error: {problem}"}

    diff_text = "\n".join(f"- {d['path']}: expected {d['expected']!r}, actual {d['actual']!r}" for d in diffs)
    payload = _build_payload(
        info,
        _PROMPT.format(workload=workload, diffs=diff_text, outliers=", ".join(outliers) or "none"),
        system="You explain Kubernetes configuration drift. Output JSON only.",
        temperature=0.2,
        json_mode=True,
    )
    url, headers = _endpoint()
    try:
        with httpx.Client(timeout=float(os.environ.get("LLM_TIMEOUT", "12"))) as client:
            r = client.post(url, json=payload, headers=headers)
            r.raise_for_status()
            content = _extract_text(info, r.json())
        parsed = _parse_json(content)
        explanation = str(parsed.get("explanation", "")).strip()
        if not explanation:
            # The call succeeded but produced no usable explanation — do NOT
            # show rule-based text as if the model wrote it.
            raise ValueError("the model returned no 'explanation' text")
        filled: list[str] = []
        fields: dict[str, str] = {}
        for src_key, out_key in (("likely_cause", "likelyCause"),
                                 ("risk", "risk"),
                                 ("recommended_action", "recommendedAction")):
            value = str(parsed.get(src_key, "")).strip()
            if value:
                fields[out_key] = value
            else:
                fields[out_key] = fb[out_key]
                filled.append(out_key)
        return {
            "explanation": explanation,
            "likelyCause": fields["likelyCause"],
            "risk": fields["risk"],
            "recommendedAction": fields["recommendedAction"],
            "source": f"ai:{info['provider']}/{info['model']}",
            "aiAttempted": True,
            "aiError": None,
            "aiPartial": bool(filled),
            "aiPartialFields": filled,
            "aiStatus": "connected",
        }
    except Exception as exc:
        # Honest fallback: the text below is rule-based, NOT AI-generated.
        reason = _classify(exc)
        return {
            **fb,
            "source": "rule-based",
            "aiAttempted": True,
            "aiError": reason,
            "errorType": type(exc).__name__,
            "aiPartial": False,
            "aiStatus": f"error: {reason}",
        }


def _parse_json(text: str) -> dict[str, Any]:
    text = text.strip()
    if text.startswith("```"):
        text = text.strip("`")
        if text.startswith("json"):
            text = text[4:]
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        start, end = text.find("{"), text.rfind("}")
        if start != -1 and end > start:
            return json.loads(text[start:end + 1])
        raise
