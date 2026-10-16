"""Minimal, dependency-free ``.env`` loader.

The README documents ``cp .env.example .env`` followed by setting
``LLM_PROVIDER`` / ``LLM_API_KEY`` etc. This module makes that actually work
without pulling in python-dotenv.

Behaviour:
- Looks for ``$CONFIGCOP_ENV_FILE`` first, then the repo root ``.env``.
- Only fills variables that are **not already set**, so real process/OS
  environment variables always win over the file.
- Never logs or returns secret values; only the path it loaded.
"""
from __future__ import annotations

import os
from pathlib import Path
from typing import Optional


def _candidates() -> list[Path]:
    env_file = os.environ.get("CONFIGCOP_ENV_FILE", "").strip()
    if env_file:
        return [Path(env_file)]
    here = Path(__file__).resolve()  # backend/app/config.py
    return [here.parents[2] / ".env", here.parents[1] / ".env"]


def _clean_value(value: str) -> str:
    value = value.strip()
    if value[:1] in ("'", '"'):
        quote = value[0]
        end = value.find(quote, 1)
        return value[1:end] if end != -1 else value[1:]
    # Drop an unquoted inline comment: KEY=value  # note
    if " #" in value:
        value = value.split(" #", 1)[0].rstrip()
    return value


def _parse(path: Path) -> None:
    for raw in path.read_text(encoding="utf-8", errors="replace").splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        if line.lower().startswith("export "):
            line = line[7:].lstrip()
        if "=" not in line:
            continue
        key, _, value = line.partition("=")
        key = key.strip()
        if not key:
            continue
        os.environ.setdefault(key, _clean_value(value))


def load_dotenv() -> Optional[str]:
    """Load the first existing ``.env`` found. Returns its path or ``None``."""
    for path in _candidates():
        try:
            if path.is_file():
                _parse(path)
                return str(path)
        except OSError:
            continue
    return None
