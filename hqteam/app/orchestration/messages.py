"""Шина событий: каждая передача между агентами — запись в agent_messages, а не «разговор в чате»."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field, field_validator
from sqlalchemy.orm import Session

from app.core.audit import audit
from app.core.models import AgentMessage, MessageType
from app.core.security import AGENT_IDS

# Адресаты-люди (очереди), не агенты
HUMAN_ADDRESSES = {"HUMAN", "CLIENT", "SALES_LEAD", "LEGAL_HUMAN", "FIN_HUMAN", "MANAGEMENT", "MARKETING_LEAD"}


MsgType = Literal["REQUEST", "RESULT", "QUESTION", "ESCALATION", "APPROVAL", "NOTIFY"]
Confidence = Literal["low", "medium", "high"]


class AgentEvent(BaseModel):
    from_agent: str
    to_agent: str
    project_id: str | None = None
    task_id: str | None = None
    type: MsgType
    payload: dict[str, Any] = Field(default_factory=dict)
    artifacts: list[str] = Field(default_factory=list)
    deadline: datetime | None = None
    confidence: Confidence | None = None
    assumptions: list[str] = Field(default_factory=list)
    needs_human: bool = False

    @field_validator("from_agent")
    @classmethod
    def _from(cls, v: str) -> str:
        if v not in AGENT_IDS and v != "SYSTEM" and not v.startswith("human:"):
            raise ValueError(f"неизвестный отправитель {v}")
        return v

    @field_validator("to_agent")
    @classmethod
    def _to(cls, v: str) -> str:
        if v not in AGENT_IDS and v not in HUMAN_ADDRESSES:
            raise ValueError(f"неизвестный адресат {v}")
        return v


def publish(db: Session, ev: AgentEvent) -> AgentMessage:
    msg = AgentMessage(
        from_agent=ev.from_agent,
        to_agent=ev.to_agent,
        project_id=ev.project_id,
        task_id=ev.task_id,
        type=MessageType(ev.type).value,
        payload=ev.payload,
        artifacts=ev.artifacts,
        deadline=ev.deadline,
        confidence=ev.confidence,
        assumptions=ev.assumptions,
        needs_human=ev.needs_human,
    )
    db.add(msg)
    db.flush()
    audit(
        db,
        ev.from_agent,
        f"message.{ev.type.lower()}",
        entity_type="agent_message",
        entity_id=msg.id,
        project_id=ev.project_id,
        after={"to": ev.to_agent, "task_id": ev.task_id, "needs_human": ev.needs_human},
    )
    return msg
