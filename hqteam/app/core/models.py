"""ORM-схема. Совместима с SQLite (dev) и PostgreSQL (prod): только переносимые типы (String, Text,
Integer, Numeric, Boolean, DateTime, JSON)."""

from __future__ import annotations

import enum
import uuid
from datetime import UTC, datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import (
    JSON,
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


def utcnow() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)


def new_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:16]}"


class TaskStatus(enum.StrEnum):
    BACKLOG = "BACKLOG"
    ASSIGNED = "ASSIGNED"
    IN_PROGRESS = "IN_PROGRESS"
    REVIEW = "REVIEW"
    APPROVED = "APPROVED"
    CHANGES_REQUESTED = "CHANGES_REQUESTED"
    DONE = "DONE"
    BLOCKED = "BLOCKED"
    ESCALATED = "ESCALATED"


class MessageType(enum.StrEnum):
    REQUEST = "REQUEST"
    RESULT = "RESULT"
    QUESTION = "QUESTION"
    ESCALATION = "ESCALATION"
    APPROVAL = "APPROVAL"
    NOTIFY = "NOTIFY"  # расширение: уведомление PM о прямой передаче (см. ADR-007)


class HumanStatus(enum.StrEnum):
    DRAFT = "DRAFT"
    PENDING_HUMAN = "PENDING_HUMAN"
    APPROVED_HUMAN = "APPROVED_HUMAN"
    REJECTED_HUMAN = "REJECTED_HUMAN"


class ApprovalStatus(enum.StrEnum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    EXECUTED = "EXECUTED"


# --------------------------------------------------------------------------- core business


class Client(Base):
    __tablename__ = "clients"
    id: Mapped[str] = mapped_column(String(40), primary_key=True, default=lambda: new_id("cli"))
    name: Mapped[str] = mapped_column(String(255))
    mdn: Mapped[str | None] = mapped_column(String(32))  # IDNO; синтетика помечена в name/sector
    sector: Mapped[str | None] = mapped_column(String(120))
    contact_consent: Mapped[bool] = mapped_column(Boolean, default=False)
    consent_source: Mapped[str | None] = mapped_column(String(500))
    is_synthetic: Mapped[bool] = mapped_column(Boolean, default=False)
    profile: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class Project(Base):
    __tablename__ = "projects"
    id: Mapped[str] = mapped_column(String(40), primary_key=True, default=lambda: new_id("prj"))
    name: Mapped[str] = mapped_column(String(255))
    client_id: Mapped[str | None] = mapped_column(ForeignKey("clients.id"))
    status: Mapped[str] = mapped_column(String(32), default="INITIATED")
    owner_pm: Mapped[str] = mapped_column(String(16), default="PM")
    tech_lead: Mapped[str | None] = mapped_column(String(16))
    budget: Mapped[Decimal | None] = mapped_column(Numeric(14, 2))
    currency: Mapped[str] = mapped_column(String(3), default="MDL")
    sla: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    is_large: Mapped[bool] = mapped_column(Boolean, default=True)
    scenario: Mapped[str | None] = mapped_column(String(64))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class Task(Base):
    __tablename__ = "tasks"
    id: Mapped[str] = mapped_column(String(40), primary_key=True, default=lambda: new_id("tsk"))
    project_id: Mapped[str | None] = mapped_column(ForeignKey("projects.id"))
    parent_id: Mapped[str | None] = mapped_column(ForeignKey("tasks.id"))
    title: Mapped[str] = mapped_column(String(255))
    kind: Mapped[str] = mapped_column(String(64))  # логический тип работы, напр. "arch.solution_hypothesis"
    assignee_agent: Mapped[str] = mapped_column(String(16))
    created_by: Mapped[str] = mapped_column(String(32))
    route: Mapped[str] = mapped_column(String(16), default="PM")  # PM | DIRECT
    status: Mapped[str] = mapped_column(String(24), default=TaskStatus.BACKLOG.value)
    priority: Mapped[int] = mapped_column(Integer, default=3)
    depends_on: Mapped[list[str]] = mapped_column(JSON, default=list)
    input_payload: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    input_artifacts: Mapped[list[str]] = mapped_column(JSON, default=list)
    output_artifacts: Mapped[list[str]] = mapped_column(JSON, default=list)
    result: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    flags: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    due_at: Mapped[datetime | None] = mapped_column(DateTime)
    attempts: Mapped[int] = mapped_column(Integer, default=0)
    blocked_reason: Mapped[str | None] = mapped_column(Text)
    version: Mapped[int] = mapped_column(Integer, default=1)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)


class AgentMessage(Base):
    __tablename__ = "agent_messages"
    id: Mapped[str] = mapped_column(String(40), primary_key=True, default=lambda: new_id("msg"))
    from_agent: Mapped[str] = mapped_column(String(32))
    to_agent: Mapped[str] = mapped_column(String(32))
    project_id: Mapped[str | None] = mapped_column(ForeignKey("projects.id"))
    task_id: Mapped[str | None] = mapped_column(ForeignKey("tasks.id"))
    type: Mapped[str] = mapped_column(String(16))
    payload: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    artifacts: Mapped[list[str]] = mapped_column(JSON, default=list)
    deadline: Mapped[datetime | None] = mapped_column(DateTime)
    confidence: Mapped[str | None] = mapped_column(String(16))
    assumptions: Mapped[list[str]] = mapped_column(JSON, default=list)
    needs_human: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class IcpSegment(Base):
    __tablename__ = "icp_segments"
    id: Mapped[str] = mapped_column(String(40), primary_key=True, default=lambda: new_id("icp"))
    project_id: Mapped[str | None] = mapped_column(ForeignKey("projects.id"))
    name: Mapped[str] = mapped_column(String(255))
    criteria: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    pains: Mapped[list[str]] = mapped_column(JSON, default=list)
    offers: Mapped[list[str]] = mapped_column(JSON, default=list)
    created_by: Mapped[str] = mapped_column(String(16), default="MKT")
    version: Mapped[int] = mapped_column(Integer, default=1)


class Lead(Base):
    __tablename__ = "leads"
    id: Mapped[str] = mapped_column(String(40), primary_key=True, default=lambda: new_id("lead"))
    project_id: Mapped[str | None] = mapped_column(ForeignKey("projects.id"))
    company: Mapped[str] = mapped_column(String(255))
    source: Mapped[str] = mapped_column(String(255))  # обязательно: откуда получен лид
    url: Mapped[str | None] = mapped_column(String(500))
    contact: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    consent: Mapped[str] = mapped_column(String(32), default="UNKNOWN")  # GRANTED | UNKNOWN | DENIED
    segment_id: Mapped[str | None] = mapped_column(ForeignKey("icp_segments.id"))
    pains: Mapped[list[str]] = mapped_column(JSON, default=list)
    qualification: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    score: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[str] = mapped_column(String(32), default="NEW")
    is_synthetic: Mapped[bool] = mapped_column(Boolean, default=False)


class Quote(Base):
    __tablename__ = "quotes"
    id: Mapped[str] = mapped_column(String(40), primary_key=True, default=lambda: new_id("quo"))
    project_id: Mapped[str | None] = mapped_column(ForeignKey("projects.id"))
    lead_id: Mapped[str | None] = mapped_column(ForeignKey("leads.id"))
    arch_spec_id: Mapped[str | None] = mapped_column(ForeignKey("artifacts.id"))
    cost_lines: Mapped[list[dict[str, Any]]] = mapped_column(JSON, default=list)
    vat_basis: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    subtotal: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=0)
    total: Mapped[Decimal | None] = mapped_column(Numeric(14, 2))
    currency: Mapped[str] = mapped_column(String(3), default="MDL")
    status: Mapped[str] = mapped_column(String(32), default=HumanStatus.DRAFT.value)
    version: Mapped[int] = mapped_column(Integer, default=1)


class Contract(Base):
    __tablename__ = "contracts"
    id: Mapped[str] = mapped_column(String(40), primary_key=True, default=lambda: new_id("ctr"))
    project_id: Mapped[str | None] = mapped_column(ForeignKey("projects.id"))
    template: Mapped[str] = mapped_column(String(120))
    version: Mapped[int] = mapped_column(Integer, default=1)
    legal_review: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    human_status: Mapped[str] = mapped_column(String(32), default=HumanStatus.DRAFT.value)
    artifact_id: Mapped[str | None] = mapped_column(ForeignKey("artifacts.id"))


class Invoice(Base):
    __tablename__ = "invoices"
    id: Mapped[str] = mapped_column(String(40), primary_key=True, default=lambda: new_id("inv"))
    project_id: Mapped[str | None] = mapped_column(ForeignKey("projects.id"))
    draft_json: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    tax_basis: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    human_status: Mapped[str] = mapped_column(String(32), default=HumanStatus.DRAFT.value)


class Incident(Base):
    __tablename__ = "incidents"
    id: Mapped[str] = mapped_column(String(40), primary_key=True, default=lambda: new_id("inc"))
    client_id: Mapped[str | None] = mapped_column(ForeignKey("clients.id"))
    project_id: Mapped[str | None] = mapped_column(ForeignKey("projects.id"))
    title: Mapped[str] = mapped_column(String(255))
    severity: Mapped[str] = mapped_column(String(8))  # P1..P4
    sla_deadline: Mapped[datetime | None] = mapped_column(DateTime)
    status: Mapped[str] = mapped_column(String(32), default="OPEN")
    diagnostics: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    root_cause: Mapped[str | None] = mapped_column(Text)
    escalated_to: Mapped[str | None] = mapped_column(String(16))


class Artifact(Base):
    __tablename__ = "artifacts"
    __table_args__ = (UniqueConstraint("project_id", "name", "version", name="uq_artifact_version"),)
    id: Mapped[str] = mapped_column(String(40), primary_key=True, default=lambda: new_id("art"))
    project_id: Mapped[str | None] = mapped_column(ForeignKey("projects.id"))
    task_id: Mapped[str | None] = mapped_column(ForeignKey("tasks.id"))
    agent_id: Mapped[str] = mapped_column(String(16))
    type: Mapped[str] = mapped_column(String(64))
    name: Mapped[str] = mapped_column(String(255))
    path: Mapped[str] = mapped_column(String(500))
    version: Mapped[int] = mapped_column(Integer, default=1)
    checksum: Mapped[str] = mapped_column(String(64))
    status: Mapped[str] = mapped_column(String(32), default=HumanStatus.DRAFT.value)
    meta: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class KnowledgeDoc(Base):
    __tablename__ = "knowledge_docs"
    id: Mapped[str] = mapped_column(String(40), primary_key=True, default=lambda: new_id("kd"))
    role: Mapped[str] = mapped_column(String(16))
    title: Mapped[str] = mapped_column(String(500))
    source_url: Mapped[str | None] = mapped_column(String(1000))
    source_kind: Mapped[str] = mapped_column(String(32), default="internal")  # official|internal|user|template
    jurisdiction: Mapped[str | None] = mapped_column(String(16))
    version_date: Mapped[str | None] = mapped_column(String(32))
    fetched_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    checksum: Mapped[str] = mapped_column(String(64))
    verified: Mapped[bool] = mapped_column(Boolean, default=False)
    license_note: Mapped[str | None] = mapped_column(String(500))


class KnowledgeChunk(Base):
    __tablename__ = "knowledge_chunks"
    id: Mapped[str] = mapped_column(String(40), primary_key=True, default=lambda: new_id("kc"))
    doc_id: Mapped[str] = mapped_column(ForeignKey("knowledge_docs.id", ondelete="CASCADE"))
    role: Mapped[str] = mapped_column(String(16))
    ordinal: Mapped[int] = mapped_column(Integer)
    text: Mapped[str] = mapped_column(Text)
    tokens: Mapped[list[str]] = mapped_column(JSON, default=list)


class Approval(Base):
    __tablename__ = "approvals"
    id: Mapped[str] = mapped_column(String(40), primary_key=True, default=lambda: new_id("apr"))
    action_type: Mapped[str] = mapped_column(String(64))
    project_id: Mapped[str | None] = mapped_column(ForeignKey("projects.id"))
    task_id: Mapped[str | None] = mapped_column(ForeignKey("tasks.id"))
    entity_id: Mapped[str | None] = mapped_column(String(40))
    payload: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    payload_hash: Mapped[str] = mapped_column(String(64), index=True)
    required_role: Mapped[str] = mapped_column(String(32))
    requested_by: Mapped[str] = mapped_column(String(32))
    status: Mapped[str] = mapped_column(String(16), default=ApprovalStatus.PENDING.value)
    decided_by: Mapped[str | None] = mapped_column(String(64))
    decision_comment: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    decided_at: Mapped[datetime | None] = mapped_column(DateTime)


class ExternalOperation(Base):
    """Журнал внешних операций с ключом идемпотентности: повторный вызов не отправляет второй раз."""

    __tablename__ = "external_operations"
    id: Mapped[str] = mapped_column(String(40), primary_key=True, default=lambda: new_id("ext"))
    idempotency_key: Mapped[str] = mapped_column(String(128), unique=True)
    approval_id: Mapped[str] = mapped_column(ForeignKey("approvals.id"))
    action_type: Mapped[str] = mapped_column(String(64))
    mode: Mapped[str] = mapped_column(String(16))  # simulate | live
    result: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    executed_by: Mapped[str] = mapped_column(String(64))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class AuditLog(Base):
    __tablename__ = "audit_log"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    actor: Mapped[str] = mapped_column(String(64))
    action: Mapped[str] = mapped_column(String(64))
    entity_type: Mapped[str | None] = mapped_column(String(32))
    entity_id: Mapped[str | None] = mapped_column(String(40))
    project_id: Mapped[str | None] = mapped_column(String(40), index=True)
    before: Mapped[dict[str, Any] | None] = mapped_column(JSON)
    after: Mapped[dict[str, Any] | None] = mapped_column(JSON)
    timestamp: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class LlmCall(Base):
    """Журнал стоимости LLM-вызовов."""

    __tablename__ = "llm_calls"
    id: Mapped[str] = mapped_column(String(40), primary_key=True, default=lambda: new_id("llm"))
    agent_id: Mapped[str] = mapped_column(String(16))
    task_id: Mapped[str | None] = mapped_column(String(40), index=True)
    model: Mapped[str] = mapped_column(String(64))
    mode: Mapped[str] = mapped_column(String(16))
    input_tokens: Mapped[int] = mapped_column(Integer, default=0)
    output_tokens: Mapped[int] = mapped_column(Integer, default=0)
    cost_usd: Mapped[Decimal] = mapped_column(Numeric(12, 6), default=0)
    stop_reason: Mapped[str | None] = mapped_column(String(32))
    error: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class Decision(Base):
    """Реестр решений проекта (ведёт PM)."""

    __tablename__ = "decisions"
    id: Mapped[str] = mapped_column(String(40), primary_key=True, default=lambda: new_id("dec"))
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id"))
    title: Mapped[str] = mapped_column(String(255))
    rationale: Mapped[str] = mapped_column(Text)
    decided_by: Mapped[str] = mapped_column(String(32))
    status: Mapped[str] = mapped_column(String(32), default="PROPOSED")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class OpenQuestion(Base):
    __tablename__ = "open_questions"
    id: Mapped[str] = mapped_column(String(40), primary_key=True, default=lambda: new_id("oq"))
    project_id: Mapped[str | None] = mapped_column(ForeignKey("projects.id"))
    task_id: Mapped[str | None] = mapped_column(ForeignKey("tasks.id"))
    raised_by: Mapped[str] = mapped_column(String(16))
    addressee: Mapped[str] = mapped_column(String(32))  # CLIENT | HUMAN_LEGAL | FIN_HUMAN | agent id
    question: Mapped[str] = mapped_column(Text)
    category: Mapped[str] = mapped_column(String(32), default="GENERAL")  # NOT_VERIFIED, NEEDS_VERIFICATION...
    status: Mapped[str] = mapped_column(String(16), default="OPEN")


class Principal(Base):
    """Люди и сервисы, вызывающие API. Хранится только SHA-256 хэш ключа."""

    __tablename__ = "principals"
    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    kind: Mapped[str] = mapped_column(String(16))  # human | service
    roles: Mapped[list[str]] = mapped_column(JSON, default=list)
    api_key_hash: Mapped[str] = mapped_column(String(64), unique=True)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
