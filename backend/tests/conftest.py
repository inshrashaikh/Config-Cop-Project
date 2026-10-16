"""Test fixtures for the Config Cop backend.

Keeps tests hermetic:
- writes SQLite/baselines to a throwaway temp dir (never the real backend/data)
- forces CLUSTER_MODE=simulated so no test ever touches a real cluster
- clears LLM_* env vars before each test so provider config is explicit
"""
from __future__ import annotations

import os
import sys
import tempfile
from pathlib import Path

import pytest

# --- must happen before any `app.*` import reads the environment -----------
_TMP_DATA = tempfile.mkdtemp(prefix="configcop-tests-")
os.environ["CONFIGCOP_DATA"] = _TMP_DATA
os.environ["CLUSTER_MODE"] = "simulated"
os.environ["LLM_PROVIDER"] = "none"

_BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(_BACKEND_DIR))

_LLM_KEYS = ("LLM_PROVIDER", "LLM_MODEL", "LLM_API_KEY", "LLM_BASE_URL", "LLM_TIMEOUT")


@pytest.fixture(autouse=True)
def clean_llm_env(monkeypatch: pytest.MonkeyPatch) -> None:
    for key in _LLM_KEYS:
        monkeypatch.delenv(key, raising=False)
    yield
