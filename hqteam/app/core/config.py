"""Конфигурация приложения. Все секреты — только из окружения (.env), не из кода."""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_prefix="HQ_", extra="ignore")

    env: Literal["dev", "test", "prod"] = "dev"
    database_url: str = f"sqlite:///{BASE_DIR / 'hqteam.db'}"

    # Артефакты: local | s3
    artifact_backend: Literal["local", "s3"] = "local"
    artifacts_dir: Path = BASE_DIR / "artifacts"
    outbox_dir: Path = BASE_DIR / "outbox"
    s3_bucket: str | None = None

    # LLM. offline — детерминированный режим без сети (тесты, сценарии на синтетике).
    llm_mode: Literal["offline", "live"] = "offline"
    llm_model: str = "claude-opus-5-5"
    llm_effort: Literal["low", "medium", "high", "xhigh", "max"] = "medium"
    llm_max_tokens: int = 16000
    llm_timeout_s: float = 120.0
    llm_max_retries: int = 3
    llm_server_fallbacks: bool = True
    # Цены $/1M токенов. Значения по умолчанию взяты из справочника Anthropic
    # (кэш от 2026-10-06) — перед продом сверить с https://platform.claude.com/docs/en/about-claude/pricing
    llm_price_input_per_mtok: float = 4.0
    llm_price_output_per_mtok: float = 20.0

    # Лимиты на задачу
    task_max_llm_calls: int = 8
    task_max_cost_usd: float = 2.0
    task_max_attempts: int = 3

    # SLA движения задачи (минуты), после которого — эскалация к PM
    task_stale_minutes: int = 240

    # Свежесть источников права/налогов (дни)
    legal_source_max_age_days: int = 90

    # Внешние операции: в тестовом режиме отправка имитируется (пишется в outbox/)
    external_send_mode: Literal["simulate", "live"] = "simulate"

    # Bootstrap API-ключи людей (только для dev/seed). В проде — secret manager.
    bootstrap_admin_key: str | None = Field(default=None)
    legal_fetch_allowed_hosts: str = (
        "lex.justice.md,www.legis.md,legis.md,datepersonale.md,sfs.md,www.sfs.md,eur-lex.europa.eu"
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()
