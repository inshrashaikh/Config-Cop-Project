"""Config Cop backend package.

Load local ``.env`` (if present) before any submodule reads environment
variables, so the documented ``cp .env.example .env`` workflow works.
Real process environment variables always take precedence.
"""
from __future__ import annotations

from .config import load_dotenv as _load_dotenv

load_dotenv = _load_dotenv
load_dotenv()

del _load_dotenv
