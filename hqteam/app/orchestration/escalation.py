from __future__ import annotations

from datetime import datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.models import OpenQuestion, Task, TaskStatus, utcnow
from app.orchestration.messages import AgentEvent, publish
from app.orchestration.state_machine import can_transition, transition


def escalate(
    db: Session, task: Task, *, reason: str, actor: str = "SYSTEM", needs_human: bool = False
) -> Task:
    if task.status != TaskStatus.ESCALATED.value and can_transition(task.status, TaskStatus.ESCALATED.value):
        transition(db, task, TaskStatus.ESCALATED, actor=actor, reason=reason)
    task.flags = {**(task.flags or {}), "escalation_reason": reason, "pm_triaged": False}
    publish(
        db,
        AgentEvent(
            from_agent=actor if actor != "SYSTEM" else "SYSTEM",
            to_agent="PM",
            project_id=task.project_id,
            task_id=task.id,
            type="ESCALATION",
            payload={"reason": reason, "assignee": task.assignee_agent, "kind": task.kind},
            needs_human=needs_human,
        ),
    )
    return task


def check_stale(db: Session, now: datetime | None = None) -> list[Task]:
    """Эскалирует задачи, которые не двигаются дольше SLA (п. 3C)."""
    now = now or utcnow()
    limit = now - timedelta(minutes=get_settings().task_stale_minutes)
    rows = db.execute(
        select(Task).where(
            Task.status.in_([TaskStatus.ASSIGNED.value, TaskStatus.IN_PROGRESS.value, TaskStatus.BLOCKED.value]),
            Task.updated_at < limit,
        )
    ).scalars()
    out = []
    for t in rows:
        escalate(db, t, reason=f"задача не движется дольше {get_settings().task_stale_minutes} мин")
        out.append(t)
    return out


def report_conflict(db: Session, task: Task, *, a: str, b: str, detail: str) -> Task:
    db.add(
        OpenQuestion(
            project_id=task.project_id,
            task_id=task.id,
            raised_by="SYSTEM",
            addressee="PM",
            question=f"Противоречие {a} vs {b}: {detail}",
            category="ROLE_CONFLICT",
        )
    )
    return escalate(db, task, reason=f"противоречие ролей {a}/{b}: {detail}")
