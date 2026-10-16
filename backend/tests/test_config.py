"""Tests for the dependency-free .env loader (app/config.py)."""
from __future__ import annotations

import os

import pytest

from app import config


def _write(tmp_path, text: str):
    path = tmp_path / ".env"
    path.write_text(text, encoding="utf-8")
    return path


def test_parse_sets_missing_and_strips_quotes(tmp_path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("CC_QUOTED", "placeholder")
    monkeypatch.delenv("CC_QUOTED")
    monkeypatch.delenv("CC_PLAIN", raising=False)
    monkeypatch.delenv("CC_EXPORT", raising=False)
    path = _write(tmp_path, (
        "# a comment\n"
        "\n"
        "CC_PLAIN=hello world\n"
        'CC_QUOTED="secret value"   # trailing note\n'
        "export CC_EXPORT='x'\n"
        "CC_BLANK=\n"
    ))
    config._parse(path)
    assert os.environ["CC_PLAIN"] == "hello world"
    assert os.environ["CC_QUOTED"] == "secret value"
    assert os.environ["CC_EXPORT"] == "x"
    assert os.environ["CC_BLANK"] == ""


def test_parse_never_overrides_existing(tmp_path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("CC_KEEP", "from-process")
    path = _write(tmp_path, "CC_KEEP=from-file\n")
    config._parse(path)
    assert os.environ["CC_KEEP"] == "from-process"


def test_load_dotenv_uses_env_file_override(tmp_path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("CC_FROM_FILE", raising=False)
    path = _write(tmp_path, "CC_FROM_FILE=loaded\n")
    monkeypatch.setenv("CONFIGCOP_ENV_FILE", str(path))
    loaded = config.load_dotenv()
    assert loaded == str(path)
    assert os.environ["CC_FROM_FILE"] == "loaded"


def test_load_dotenv_missing_file_is_none(tmp_path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("CONFIGCOP_ENV_FILE", str(tmp_path / "nope.env"))
    assert config.load_dotenv() is None
