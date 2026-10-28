"""Единый LLM-клиент: retry, таймауты, лимит токенов, лимит вызовов/стоимости на задачу, журнал стоимости.

Режимы:
- offline: детерминированная заглушка без сети. Используется в тестах и в сценариях на синтетике,
  чтобы прогоны были воспроизводимыми. Структурированные результаты агентов (суммы, статусы,
  ссылки на источники) считают инструменты, а не модель — LLM пишет только пояснительный текст.
- live: Anthropic Messages API (модель и цены — из настроек).
"""

from __future__ import annotations

import hashlib
from dataclasses import dataclass
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.core.logging import log, mask_text
from app.core.models import LlmCall


class BudgetExceeded(Exception):
    pass


class LlmRefused(Exception):
    pass


@dataclass
class LlmResult:
    text: str
    input_tokens: int
    output_tokens: int
    cost_usd: Decimal
    model: str
    mode: str
    stop_reason: str | None


class LlmClient:
    def __init__(self, settings: Settings | None = None, anthropic_client: object | None = None):
        self.s = settings or get_settings()
        self._client = anthropic_client

    # ------------------------------------------------------------------ limits
    def _usage(self, db: Session, task_id: str | None) -> tuple[int, Decimal]:
        if task_id is None:
            return 0, Decimal(0)
        row = db.execute(
            select(func.count(LlmCall.id), func.coalesce(func.sum(LlmCall.cost_usd), 0)).where(
                LlmCall.task_id == task_id
            )
        ).one()
        return int(row[0]), Decimal(str(row[1]))

    def check_budget(self, db: Session, task_id: str | None) -> None:
        calls, cost = self._usage(db, task_id)
        if calls >= self.s.task_max_llm_calls:
            raise BudgetExceeded(f"лимит LLM-вызовов на задачу исчерпан ({calls}/{self.s.task_max_llm_calls})")
        if cost >= Decimal(str(self.s.task_max_cost_usd)):
            raise BudgetExceeded(f"лимит стоимости на задачу исчерпан (${cost} / ${self.s.task_max_cost_usd})")

    def price(self, input_tokens: int, output_tokens: int) -> Decimal:
        return (
            Decimal(input_tokens) * Decimal(str(self.s.llm_price_input_per_mtok))
            + Decimal(output_tokens) * Decimal(str(self.s.llm_price_output_per_mtok))
        ) / Decimal(1_000_000)

    # ------------------------------------------------------------------ call
    def complete(
        self,
        db: Session,
        *,
        agent_id: str,
        task_id: str | None,
        system: str,
        prompt: str,
        max_tokens: int | None = None,
    ) -> LlmResult:
        self.check_budget(db, task_id)
        max_tokens = min(max_tokens or self.s.llm_max_tokens, self.s.llm_max_tokens)
        if self.s.llm_mode == "offline":
            res = self._offline(agent_id, prompt)
        else:
            res = self._live(system, prompt, max_tokens)
        db.add(
            LlmCall(
                agent_id=agent_id,
                task_id=task_id,
                model=res.model,
                mode=res.mode,
                input_tokens=res.input_tokens,
                output_tokens=res.output_tokens,
                cost_usd=res.cost_usd,
                stop_reason=res.stop_reason,
            )
        )
        db.flush()
        return res

    def _offline(self, agent_id: str, prompt: str) -> LlmResult:
        digest = hashlib.sha256(prompt.encode()).hexdigest()[:8]
        text = (
            f"[OFFLINE-{agent_id}-{digest}] Пояснительный текст не сгенерирован: LLM в режиме offline. "
            "Структурированные данные ниже рассчитаны инструментами."
        )
        return LlmResult(text, 0, 0, Decimal(0), "offline-stub", "offline", "end_turn")

    def _get_client(self):  # pragma: no cover - требует сети и ключа
        if self._client is None:
            import anthropic

            self._client = anthropic.Anthropic(timeout=self.s.llm_timeout_s, max_retries=self.s.llm_max_retries)
        return self._client

    def _live(self, system: str, prompt: str, max_tokens: int) -> LlmResult:  # pragma: no cover - сеть
        import anthropic

        client = self._get_client()
        kwargs: dict = {
            "model": self.s.llm_model,
            "max_tokens": max_tokens,
            "system": system,
            "messages": [{"role": "user", "content": prompt}],
            "output_config": {"effort": self.s.llm_effort},
        }
        if self.s.llm_server_fallbacks:
            kwargs["fallbacks"] = "default"
            kwargs["betas"] = ["server-side-fallback-2026-07-01"]
        try:
            msg = client.beta.messages.create(**kwargs)
        except anthropic.RateLimitError as e:
            raise RuntimeError(f"LLM rate limit после {self.s.llm_max_retries} повторов") from e
        except anthropic.APIStatusError as e:
            log.error("LLM API error status=%s msg=%s", e.status_code, mask_text(str(e.message)))
            raise
        except anthropic.APIConnectionError as e:
            raise RuntimeError("LLM недоступен (сеть/таймаут)") from e
        if msg.stop_reason == "refusal":
            raise LlmRefused("Модель отказалась выполнять запрос; требуется проверка человеком")
        text = "".join(getattr(b, "text", "") for b in msg.content if getattr(b, "type", "") == "text")
        u = msg.usage
        return LlmResult(
            text=text,
            input_tokens=u.input_tokens,
            output_tokens=u.output_tokens,
            cost_usd=self.price(u.input_tokens, u.output_tokens),
            model=msg.model,
            mode="live",
            stop_reason=msg.stop_reason,
        )
