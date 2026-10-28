"""Human-in-the-loop: очередь одобрений, привязка к хэшу содержимого, идемпотентное исполнение.

Инварианты:
- агент может только ЗАПРОСИТЬ действие уровня 2; решает человек с нужной ролью;
- одобрение привязано к payload_hash: изменили содержимое после одобрения — исполнять нельзя;
- исполнение идемпотентно по idempotency_key: повтор не отправляет второй раз;
- в режиме simulate «отправка» пишет файл в outbox/, ничего не уходит наружу.
"""

from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.audit import audit
from app.core.config import get_settings
from app.core.models import (
    Approval,
    ApprovalStatus,
    Artifact,
    Contract,
    ExternalOperation,
    HumanStatus,
    Invoice,
    Quote,
    utcnow,
)
from app.core.security import APPROVAL_ACTIONS, Caller, PermissionDenied, check_action
from app.orchestration.messages import AgentEvent, publish


class ApprovalError(Exception):
    pass


def payload_hash(action_type: str, entity_id: str | None, payload: dict[str, Any]) -> str:
    canon = json.dumps({"a": action_type, "e": entity_id, "p": payload}, sort_keys=True, ensure_ascii=False,
                       default=str)
    return hashlib.sha256(canon.encode()).hexdigest()


_ENTITY_MODELS = {"quote": Quote, "contract": Contract, "invoice": Invoice, "artifact": Artifact}


def _set_entity_status(db: Session, entity_type: str | None, entity_id: str | None, status: HumanStatus) -> None:
    if not entity_type or not entity_id:
        return
    model = _ENTITY_MODELS.get(entity_type)
    if model is None:
        return
    obj = db.get(model, entity_id)
    if obj is None:
        return
    field = "human_status" if hasattr(obj, "human_status") else "status"
    setattr(obj, field, status.value)


def request(
    db: Session,
    *,
    agent: str,
    action_type: str,
    payload: dict[str, Any],
    project_id: str | None = None,
    task_id: str | None = None,
    entity_type: str | None = None,
    entity_id: str | None = None,
) -> Approval:
    check_action(agent, action_type)  # уровень 3 → PermissionDenied; чужое действие → PermissionDenied
    if action_type not in APPROVAL_ACTIONS:
        raise ApprovalError(f"{action_type} не требует одобрения (уровень 1)")
    body = {**payload, "_entity_type": entity_type}
    h = payload_hash(action_type, entity_id, body)
    existing = db.execute(
        select(Approval).where(
            Approval.payload_hash == h, Approval.status != ApprovalStatus.REJECTED.value
        )
    ).scalar_one_or_none()
    if existing:
        return existing  # идемпотентный запрос
    apr = Approval(
        action_type=action_type,
        project_id=project_id,
        task_id=task_id,
        entity_id=entity_id,
        payload=body,
        payload_hash=h,
        required_role=APPROVAL_ACTIONS[action_type],
        requested_by=agent,
    )
    db.add(apr)
    db.flush()
    _set_entity_status(db, entity_type, entity_id, HumanStatus.PENDING_HUMAN)
    audit(db, agent, "approval.request", entity_type="approval", entity_id=apr.id, project_id=project_id,
          after={"action_type": action_type, "required_role": apr.required_role, "hash": h})
    publish(db, AgentEvent(from_agent=agent, to_agent=apr.required_role, project_id=project_id, task_id=task_id,
                           type="APPROVAL", payload={"approval_id": apr.id, "action_type": action_type},
                           needs_human=True))
    return apr


def decide(db: Session, approval_id: str, *, caller: Caller, approve: bool, comment: str | None = None) -> Approval:
    apr = db.get(Approval, approval_id)
    if apr is None:
        raise ApprovalError("approval не найден")
    if caller.kind != "human":
        raise PermissionDenied("решение по approval принимает только человек")
    if not caller.has(apr.required_role):
        raise PermissionDenied(f"нужна роль {apr.required_role}")
    if apr.status != ApprovalStatus.PENDING.value:
        raise ApprovalError(f"approval уже в статусе {apr.status}")
    if payload_hash(apr.action_type, apr.entity_id, apr.payload) != apr.payload_hash:
        raise ApprovalError("содержимое изменено после запроса — нужен новый запрос")
    before = {"status": apr.status}
    apr.status = (ApprovalStatus.APPROVED if approve else ApprovalStatus.REJECTED).value
    apr.decided_by = caller.id
    apr.decision_comment = comment
    apr.decided_at = utcnow()
    _set_entity_status(db, apr.payload.get("_entity_type"), apr.entity_id,
                       HumanStatus.APPROVED_HUMAN if approve else HumanStatus.REJECTED_HUMAN)
    audit(db, f"human:{caller.id}", "approval.decide", entity_type="approval", entity_id=apr.id,
          project_id=apr.project_id, before=before, after={"status": apr.status, "comment": comment})
    return apr


def _current_artifact_checksum(db: Session, artifact_id: str) -> str | None:
    art = db.get(Artifact, artifact_id)
    if art is None:
        return None
    latest = db.execute(
        select(Artifact).where(Artifact.project_id == art.project_id, Artifact.name == art.name)
        .order_by(Artifact.version.desc())
    ).scalars().first()
    return latest.checksum if latest else None


def execute(db: Session, approval_id: str, *, executor: str, idempotency_key: str | None = None) -> ExternalOperation:
    """Исполняет одобренную внешнюю операцию. Повторный вызов с тем же ключом вернёт прежний результат."""
    key = idempotency_key or f"approval:{approval_id}"
    prior = db.execute(select(ExternalOperation).where(ExternalOperation.idempotency_key == key)).scalar_one_or_none()
    if prior is not None:
        return prior
    apr = db.get(Approval, approval_id)
    if apr is None:
        raise ApprovalError("approval не найден")
    if apr.status == ApprovalStatus.EXECUTED.value:
        done = db.execute(select(ExternalOperation).where(ExternalOperation.approval_id == apr.id)).scalars().first()
        if done:
            return done
    if apr.status != ApprovalStatus.APPROVED.value:
        raise ApprovalError(f"исполнение невозможно: статус {apr.status}, нужен APPROVED")
    if payload_hash(apr.action_type, apr.entity_id, apr.payload) != apr.payload_hash:
        raise ApprovalError("payload изменён после одобрения")
    # одобряли конкретную версию артефакта — если он изменился, исполнять нельзя
    for art_id, checksum in (apr.payload.get("artifact_checksums") or {}).items():
        if _current_artifact_checksum(db, art_id) != checksum:
            raise ApprovalError(f"артефакт {art_id} изменён после одобрения — нужен новый approval")

    s = get_settings()
    if s.external_send_mode != "simulate":  # pragma: no cover - нет реальных интеграций
        raise ApprovalError("live-режим внешних отправок не подключён: настройте провайдера (см. docs/RUNBOOK)")
    out_dir = Path(s.outbox_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    out_file = out_dir / f"{apr.id}.json"
    out_file.write_text(
        json.dumps({"simulated": True, "action_type": apr.action_type, "approval_id": apr.id,
                    "approved_by": apr.decided_by, "payload": apr.payload}, ensure_ascii=False, indent=2,
                   default=str),
        encoding="utf-8",
    )
    op = ExternalOperation(idempotency_key=key, approval_id=apr.id, action_type=apr.action_type, mode="simulate",
                           result={"outbox_file": out_file.name, "simulated": True}, executed_by=executor)
    db.add(op)
    apr.status = ApprovalStatus.EXECUTED.value
    db.flush()
    audit(db, executor, "external.execute", entity_type="approval", entity_id=apr.id, project_id=apr.project_id,
          after={"action_type": apr.action_type, "mode": "simulate", "idempotency_key": key})
    return op


def pending(db: Session, project_id: str | None = None) -> list[Approval]:
    q = select(Approval).where(Approval.status == ApprovalStatus.PENDING.value)
    if project_id:
        q = q.where(Approval.project_id == project_id)
    return list(db.execute(q.order_by(Approval.created_at)).scalars())
