from __future__ import annotations

from sqlalchemy.orm import Session

from app.core.audit import audit
from app.core.models import Task
from app.core.models import TaskStatus as S

TRANSITIONS: dict[S, frozenset[S]] = {
    S.BACKLOG: frozenset({S.ASSIGNED, S.BLOCKED, S.ESCALATED}),
    S.ASSIGNED: frozenset({S.IN_PROGRESS, S.BLOCKED, S.ESCALATED}),
    S.IN_PROGRESS: frozenset({S.REVIEW, S.BLOCKED, S.ESCALATED}),
    S.REVIEW: frozenset({S.APPROVED, S.CHANGES_REQUESTED, S.ESCALATED}),
    S.CHANGES_REQUESTED: frozenset({S.IN_PROGRESS, S.BLOCKED, S.ESCALATED}),
    S.APPROVED: frozenset({S.DONE}),
    S.BLOCKED: frozenset({S.ASSIGNED, S.IN_PROGRESS, S.ESCALATED}),
    S.ESCALATED: frozenset({S.ASSIGNED, S.BLOCKED}),
    S.DONE: frozenset(),
}

TERMINAL = frozenset({S.DONE})


class InvalidTransition(Exception):
    pass


def can_transition(src: str, dst: str) -> bool:
    return S(dst) in TRANSITIONS[S(src)]


def transition(db: Session, task: Task, dst: S | str, *, actor: str, reason: str | None = None) -> Task:
    dst = S(dst)
    src = S(task.status)
    if dst not in TRANSITIONS[src]:
        raise InvalidTransition(f"{task.id}: {src} → {dst} недопустим")
    task.status = dst.value
    task.version += 1
    if dst is S.BLOCKED:
        task.blocked_reason = reason
    elif dst in (S.ASSIGNED, S.IN_PROGRESS):
        task.blocked_reason = None
    db.flush()
    audit(
        db,
        actor,
        "task.transition",
        entity_type="task",
        entity_id=task.id,
        project_id=task.project_id,
        before={"status": src.value},
        after={"status": dst.value, "reason": reason},
    )
    return task
