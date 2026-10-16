"""Real AI explainability verification (makes ACTUAL provider API calls).

Usage (from the repo root, after configuring .env or exporting env vars):

    python scripts/verify_ai.py

It reads credentials ONLY from environment variables (.env is loaded too) and
never prints the key. Exit code 0 = a real model call succeeded and returned a
usable explanation; non-zero = not verified (with the exact reason).

This is intentionally separate from the mocked pytest suite: only this script
proves a real provider works.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from app import llm  # noqa: E402  (path set above; also loads .env)

SAMPLE_DIFFS = [
    {"path": "replicas", "expected": 3, "actual": 1},
    {"path": "resources.limits.cpu", "expected": "500m", "actual": "100m"},
    {"path": "env.LOG_LEVEL", "expected": "info", "actual": "debug"},
]


def _rule(label: str, ok: bool | None = None) -> None:
    mark = "" if ok is None else ("  [PASS]" if ok else "  [FAIL]")
    print(f"\n=== {label}{mark} ===")


def main() -> int:
    info = llm.provider_info()
    _rule("Configuration")
    print(json.dumps({k: info[k] for k in
                      ("provider", "model", "baseUrl", "enabled", "hasKey", "keyRequired", "missingKey", "mode")},
                     indent=2))

    if not info["enabled"]:
        print("\nNo real AI provider configured — explanations use the rule-based fallback.")
        print("Set these environment variables (or put them in .env), then re-run:")
        print("  # Groq (OpenAI-compatible):")
        print("  LLM_PROVIDER=groq")
        print("  LLM_MODEL=llama-3.3-70b-versatile")
        print("  LLM_API_KEY=<your Groq key, server-side only>")
        print("  # or Google Gemini (official API):")
        print("  LLM_PROVIDER=gemini")
        print("  LLM_MODEL=gemini-3.5-flash-lite")
        print("  LLM_API_KEY=<your Google AI Studio key, server-side only>")
        return 2

    _rule("Connectivity test (real provider API request)")
    test = llm.test_connection()
    print(json.dumps(test, indent=2))
    if not test.get("ok"):
        print(f"\nNOT VERIFIED: {test.get('error')}")
        return 1

    _rule("Real drift explanation (real API call)")
    out = llm.explain("checkout-api", SAMPLE_DIFFS, ["checkout-api"])
    printable = {k: out.get(k) for k in
                 ("source", "explanation", "likelyCause", "risk", "recommendedAction",
                  "aiAttempted", "aiError", "aiPartial")}
    print(json.dumps(printable, indent=2))

    verified = str(out.get("source", "")).startswith("ai:") and not out.get("aiError")
    _rule("Result", verified)
    if verified:
        print("Real AI explainability VERIFIED — the model returned a usable explanation.")
        return 0
    print(f"NOT VERIFIED: {out.get('aiError') or 'model response unusable'}")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
