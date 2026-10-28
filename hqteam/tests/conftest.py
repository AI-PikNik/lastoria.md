from __future__ import annotations

import os
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
os.environ["HQ_ENV"] = "test"
os.environ["HQ_LLM_MODE"] = "offline"
os.environ["HQ_EXTERNAL_SEND_MODE"] = "simulate"
os.environ.pop("ANTHROPIC_API_KEY", None)


@pytest.fixture(autouse=True)
def _settings(tmp_path, monkeypatch):
    monkeypatch.setenv("HQ_ARTIFACTS_DIR", str(tmp_path / "artifacts"))
    monkeypatch.setenv("HQ_OUTBOX_DIR", str(tmp_path / "outbox"))
    monkeypatch.setenv("HQ_DATABASE_URL", "sqlite://")
    from app.core.config import get_settings

    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


@pytest.fixture
def db():
    from app.core.db import create_all, init_engine, new_session

    init_engine("sqlite://")
    create_all()
    s = new_session()
    try:
        yield s
    finally:
        s.rollback()
        s.close()


@pytest.fixture
def seeded(db):
    from db.seed import seed_knowledge

    seed_knowledge(db)
    return db


@pytest.fixture
def outbox(tmp_path):
    return tmp_path / "outbox"


def human(role: str, pid: str | None = None):
    from app.core.security import Caller

    return Caller(id=pid or f"t-{role.lower()}", kind="human", roles=frozenset({role}))
