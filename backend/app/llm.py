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

# --------------------------------------------------- explainable per-field briefs
# severity ordering used to pick the overall severity of a drift
_SEV_ORDER = {"low": 0, "medium": 1, "high": 2, "critical": 3}


def _num(v: Any) -> float | None:
    try:
        s = str(v)
        if s.endswith("m"):      # cpu millis
            return float(s[:-1])
        if s.endswith("Gi"):
            return float(s[:-2]) * 1024
        if s.endswith("Mi"):
            return float(s[:-2])
        return float(s)
    except (TypeError, ValueError):
        return None


def field_brief(path: str, expected: Any, actual: Any) -> dict[str, Any]:
    """Plain-language, per-field 'what changed / why it matters' — the explainable layer.

    Every drift field gets a concrete explanation with a severity, so the UI can
    walk through the diff row by row instead of showing one generic paragraph.
    """
    e, a = expected, actual

    if path.startswith("resources.limits.cpu"):
        lo = _num(e) or 0
        na = _num(a) or 0
        if na < lo:
            return {"severity": "high",
                    "what": f"CPU limit lowered {e} → {a}",
                    "why": "The container can now be throttled by the CFS quota well before it "
                           "used to be. Under any load spike the pods will burn through their "
                           "CPU budget and requests will queue — p99 latency goes up while "
                           "Kubernetes still reports the pod as Healthy.",
                    "impact": "Throttling under load, slow responses, hard-to-diagnose latency."}
        return {"severity": "medium",
                "what": f"CPU limit raised {e} → {a}",
                "why": "A much higher CPU limit lets one pod consume more of the node. If several "
                       "pods burst together the node can become noisy for neighbours (Noisy Neighbour).",
                "impact": "Potential node-level contention and higher cost, no immediate outage."}

    if path.startswith("resources.limits.memory"):
        lo = _num(e) or 0
        na = _num(a) or 0
        if na > lo * 2:
            return {"severity": "medium",
                    "what": f"Memory limit raised {e} → {a} (≈{int(na / max(lo, 1))}x)",
                    "why": "Each pod may now grow far larger before Kubernetes intervenes. One "
                           "leaky pod can push the node into memory pressure and evict other workloads.",
                    "impact": "Node memory pressure, possible eviction of unrelated pods."}
        return {"severity": "critical",
                "what": f"Memory limit tightened {e} → {a}",
                "why": "The kernel OOM-killer terminates any pod that exceeds its memory limit. "
                       "A limit below the working set means pods get SIGKILLed mid-request — "
                       "Kubernetes then restarts them, and you see CrashLoop/OOMKilled events.",
                "impact": "OOMKilled pods, restart loops, dropped in-flight requests."}

    if path.startswith("resources.requests.cpu"):
        return {"severity": "medium",
                "what": f"CPU request changed {e} → {a}",
                "why": "Requests drive scheduling. A higher request means the scheduler fits fewer "
                       "pods per node; a lower one risks CPU contention after scale-out.",
                "impact": "Changed packing/scheduling behaviour across the node."}

    if path.startswith("resources.requests.memory"):
        return {"severity": "medium",
                "what": f"Memory request changed {e} → {a}",
                "why": "Kubernetes reserves this much memory on the node for every replica. It must "
                       "stay ≤ the limit and large jumps change where pods can be scheduled.",
                "impact": "Scheduling changes; if request > limit the Deployment stops rolling out."}

    if path == "replicas":
        try:
            down = int(a) < int(e)
        except (TypeError, ValueError):
            down = False
        if down:
            return {"severity": "high",
                    "what": f"Replica count cut {e} → {a}",
                    "why": "Fewer replicas mean less redundancy: with fewer pods, one node failure or "
                           "rollout takes a bigger share of traffic out. Throughput ceiling drops too.",
                    "impact": "Reduced availability and capacity; higher blast radius per failure."}
        return {"severity": "low",
                "what": f"Replica count increased {e} → {a}",
                "why": "More replicas cost more and are usually outside the approved capacity plan; "
                       "surplus replicas also amplify any bad config across more pods.",
                "impact": "Higher cost; a bad change now affects more pods."}

    if path == "image":
        return {"severity": "high",
                "what": f"Container image changed {e} → {a}",
                "why": "An image swap ships different code/config into production without a review or "
                       "deploy pipeline. Version downgrades also silently drop security patches.",
                "impact": "Unreviewed behaviour change; possible rollback of fixes/CVEs."}

    if path == "env.LOG_LEVEL":
        debug = str(a).lower() == "debug"
        if debug:
            return {"severity": "medium",
                    "what": f"Log level switched {e} → {a}",
                    "why": "Debug logging emits far more lines: it burns CPU/IO on formatting and can "
                           "fill the log pipeline, masking real errors in noise.",
                    "impact": "Performance drag, noisy logs, higher logging cost."}
        return {"severity": "low",
                "what": f"Log level switched {e} → {a}",
                "why": "A less verbose level hides diagnostic detail you may need during the next incident.",
                "impact": "Less visibility during incidents."}

    if path == "env.DB_POOL_SIZE":
        try:
            over = int(a) > int(e)
        except (TypeError, ValueError):
            over = False
        if over:
            return {"severity": "high",
                    "what": f"DB connection pool size jumped {e} → {a}",
                    "why": "Every replica now opens many more database connections. Multiplied across "
                           "pods this can exhaust the database's max_connections and knock the whole "
                           "service (and its neighbours) offline.",
                    "impact": "Database connection exhaustion, cascading failures."}
        return {"severity": "medium",
                "what": f"DB connection pool size changed {e} → {a}",
                "why": "A smaller pool can make requests queue waiting for a connection under load.",
                "impact": "Pool exhaustion on one side, latency under load."}

    if path.startswith("probes.liveness"):
        return {"severity": "medium",
                "what": f"Liveness probe initialDelay changed {e} → {a}",
                "why": "Kubernetes waits this long before health-checking the app. A large delay keeps "
                       "a hung or half-started pod in rotation longer than it should be.",
                "impact": "Broken pods may serve traffic before the probe can restart them."}

    if path.startswith("env."):
        return {"severity": "medium",
                "what": f"Environment variable {path.split('.', 1)[1]} changed {e!r} → {a!r}",
                "why": "Env vars change runtime behaviour instantly and without any deploy or review "
                       "trail — exactly the kind of change baselines exist to catch.",
                "impact": "Silent behaviour change in production."}

    return {"severity": "medium",
            "what": f"{path} changed {e!r} → {a!r}",
            "why": "This field no longer matches the approved baseline — it changed outside the "
                   "reviewed deploy pipeline.",
            "impact": "Unreviewed production configuration."}


def severity_max(briefs: list[dict[str, Any]]) -> str:
    if not briefs:
        return "low"
    return max((b.get("severity", "medium") for b in briefs), key=lambda s: _SEV_ORDER.get(s, 1))


def provider_info() -> dict[str, Any]:
    provider = os.environ.get("LLM_PROVIDER", "none").strip().lower()
    raw_model = os.environ.get("LLM_MODEL", "").strip()
    # LLM_MODEL may list comma-separated fallbacks (e.g. a second Gemini model
    # used when the first returns 503). The UI shows the primary one.
    models = [m.strip() for m in raw_model.split(",") if m.strip()]
    model = models[0] if models else ""
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
        "models": models,
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
            "whatHappened": "Nothing — config matches the approved baseline exactly.",
            "severity": "low",
            "confidence": 1.0,
            "fieldBriefs": [],
            "source": "rule-based",
        }
    briefs = []
    for d in diffs:
        b = field_brief(d["path"], d["expected"], d["actual"])
        briefs.append({"path": d["path"], "expected": d["expected"], "actual": d["actual"], **b})
    severity = severity_max(briefs)
    parts = [f"{d['path']} changed from {d['expected']!r} to {d['actual']!r}" for d in diffs]
    risk = next((v for k, v in RISK_HINTS.items() if any(d["path"].startswith(k) for d in diffs)),
                "Undocumented configuration change in production.")
    outlier_note = ""
    if outliers:
        outlier_note = f" IsolationForest also flags {', '.join(outliers)} as statistically unusual among these workloads."
    what = (f"{len(diffs)} field(s) drifted from the approved baseline: "
            + "; ".join(b["what"] for b in briefs) + ".")
    return {
        "explanation": ("Drift detected in " + workload + ": " + "; ".join(parts) + "."
                        + outlier_note),
        "likelyCause": "A manual change outside the deploy pipeline (e.g. kubectl edit/set image) "
                       "or an unreviewed manifest update diverged from the baseline.",
        "risk": risk,
        "recommendedAction": f"Restore the baseline values for {len(diffs)} field(s) and re-scan to verify "
                             "the fingerprint matches again.",
        "whatHappened": what,
        "severity": severity,
        "confidence": 0.95,
        "fieldBriefs": briefs,
        "source": "rule-based",
    }


_PROMPT = """You are a Kubernetes configuration drift analyst for the demo tool Config Cop.
Given a workload and the exact fields that drifted from its baseline, reply with STRICT JSON:
{{"explanation": "<2-3 plain sentences: what changed and why it matters>",
  "what_happened": "<one direct sentence: what is different right now, in plain language>",
  "likely_cause": "<what most likely caused this>",
  "risk": "<the potential operational impact if this is left unfixed>",
  "recommended_action": "<one safe remediation; only 'restore baseline values' is allowed as a fix>",
  "severity": "<critical|high|medium|low — how urgent this drift is>",
  "confidence": "<0.0-1.0 — how confident you are in this explanation>",
  "field_notes": [{{"path": "<the exact config field>", "note": "<1-2 sentences: why THIS field changing is a problem>"}}]}}
Rules: never suggest running commands, never invent fields, only use the data provided.
Write field_notes for every drifted field listed. Be concrete (throttling, OOMKill, connection exhaustion...).

Workload: {workload}
Drifted fields (expected -> actual):
{diffs}
Isolation-forest outlier flags: {outliers}
Rule-based per-field hints (use, do not copy blindly): {hints}
"""


def _endpoint() -> tuple[str, dict[str, str]]:
    """Endpoint for the configured provider's primary model."""
    return _endpoint_for(provider_info()["model"] or "")


def _models() -> list[str]:
    """Primary model plus any comma-separated fallbacks (e.g. when one 503s)."""
    raw = os.environ.get("LLM_MODEL", "")
    return [m.strip() for m in raw.split(",") if m.strip()]


def _endpoint_for(model: str) -> tuple[str, dict[str, str]]:
    info = provider_info()
    base = (info["baseUrl"] or "").rstrip("/")
    headers = {"Content-Type": "application/json"}
    key = os.environ.get("LLM_API_KEY", "").strip()
    if info["provider"] == GEMINI_PROVIDER:
        if key:
            headers["x-goog-api-key"] = key
        return f"{base}/models/{model}:generateContent", headers
    url = f"{base}/chat/completions"
    if key and info["provider"] != "ollama":
        headers["Authorization"] = f"Bearer {key}"
    return url, headers


def _post_with_retry(url: str, headers: dict[str, str], payload: dict[str, Any],
                     *, attempts: int = 3) -> Any:
    """POST and retry transient provider errors (503/429/read-timeout).

    Public LLM APIs — Gemini especially — return HTTP 503 "high demand" in short
    bursts. A couple of quick retries turns that into a reliable demo instead of
    a confusing fall-to-rule-based on half the requests.
    """
    timeout = float(os.environ.get("LLM_TIMEOUT", "12"))
    last_exc: Exception | None = None
    for i in range(attempts):
        try:
            with httpx.Client(timeout=timeout) as client:
                r = client.post(url, json=payload, headers=headers)
                r.raise_for_status()
                return r.json()
        except httpx.HTTPStatusError as exc:
            last_exc = exc
            if exc.response.status_code in (429, 503) and i < attempts - 1:
                time.sleep(0.7 * (i + 1))
                continue
            raise
        except (httpx.ReadTimeout, httpx.ConnectTimeout) as exc:
            last_exc = exc
            if i < attempts - 1:
                time.sleep(0.7 * (i + 1))
                continue
            raise
    raise last_exc if last_exc else RuntimeError("LLM request failed")


def _generate(info: dict[str, Any], user_text: str, *, system: str | None = None,
              max_tokens: int | None = None, temperature: float = 0.2,
              json_mode: bool = False) -> str:
    """Call the provider and return the text, trying each configured model.

    Each model gets transient-error retries; if one model keeps returning
    503/429 (Gemini "high demand"), the next comma-separated model in
    ``LLM_MODEL`` is tried before giving up.
    """
    models = _models() or ([info["model"]] if info["model"] else [])
    last_exc: Exception | None = None
    for idx, model in enumerate(models):
        model_info = {**info, "model": model}
        payload = _build_payload(model_info, user_text, system=system, max_tokens=max_tokens,
                                 temperature=temperature, json_mode=json_mode)
        url, headers = _endpoint_for(model)
        try:
            body = _post_with_retry(url, headers, payload)
            return _extract_text(model_info, body)
        except httpx.HTTPStatusError as exc:
            last_exc = exc
            if exc.response.status_code in (429, 503) and idx < len(models) - 1:
                continue
            raise
        except Exception as exc:  # noqa: BLE001 — re-raise; caller classifies
            last_exc = exc
            raise
    raise last_exc if last_exc else RuntimeError("LLM request failed")


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
    # Gemini thinking models can spend a tiny token budget on reasoning, so the
    # connectivity ping leaves the budget to the provider; OpenAI-compatible
    # providers keep the cheap 16-token cap.
    ping_tokens = None if info["provider"] == GEMINI_PROVIDER else 16
    t0 = time.time()
    try:
        text = _generate(info, "Reply with the single word: ok",
                         max_tokens=ping_tokens, temperature=0)
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
    fb_briefs = {b["path"]: b for b in fb.get("fieldBriefs", [])}
    hints_text = "\n".join(f"- {p}: {b['what']} [{b['severity']}]" for p, b in fb_briefs.items())
    try:
        content = _generate(
            info,
            _PROMPT.format(workload=workload, diffs=diff_text, outliers=", ".join(outliers) or "none",
                           hints=hints_text or "none"),
            system="You explain Kubernetes configuration drift. Output JSON only.",
            temperature=0.2,
            json_mode=True,
        )
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

        # --- explainable extras (severity / confidence / per-field notes) ---
        what = str(parsed.get("what_happened", "")).strip() or fb["whatHappened"]
        severity = str(parsed.get("severity", "")).strip().lower()
        if severity not in ("critical", "high", "medium", "low"):
            severity = fb["severity"]
        try:
            confidence = round(min(1.0, max(0.0, float(parsed.get("confidence")))), 2)
        except (TypeError, ValueError):
            confidence = None
        notes = {str(n.get("path", "")).strip(): str(n.get("note", "")).strip()
                 for n in (parsed.get("field_notes") or []) if isinstance(n, dict)}
        field_briefs_out = []
        for d in diffs:
            base = fb_briefs.get(d["path"], field_brief(d["path"], d["expected"], d["actual"]))
            entry = {**base}
            if d["path"] in notes and notes[d["path"]]:
                entry["aiNote"] = notes[d["path"]]
                entry["why"] = notes[d["path"]]   # the AI note replaces the generic why in the UI
            field_briefs_out.append({"path": d["path"], "expected": d["expected"],
                                     "actual": d["actual"], **entry})

        return {
            "explanation": explanation,
            "likelyCause": fields["likelyCause"],
            "risk": fields["risk"],
            "recommendedAction": fields["recommendedAction"],
            "whatHappened": what,
            "severity": severity,
            "confidence": confidence if confidence is not None else 0.7,
            "fieldBriefs": field_briefs_out,
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
