from datetime import timedelta

import pytest
from sqlalchemy import select

from app.core.models import AuditLog, Task, TaskStatus, utcnow
from app.orchestration.escalation import check_stale
from app.orchestration.scheduler import run_task
from app.orchestration.state_machine import InvalidTransition, transition


def _task(db, **kw):
    t = Task(title="t", kind=kw.pop("kind", "arch.solution_hypothesis"), assignee_agent=kw.pop("agent", "ARCH"),
             created_by="PM", **kw)
    db.add(t)
    db.flush()
    return t


def test_happy_path_and_audit(db):
    t = _task(db)
    for s in ("ASSIGNED", "IN_PROGRESS", "REVIEW", "APPROVED", "DONE"):
        transition(db, t, s, actor="PM")
    assert t.status == "DONE"
    rows = list(db.execute(select(AuditLog).where(AuditLog.entity_id == t.id)).scalars())
    assert [r.after["status"] for r in rows] == ["ASSIGNED", "IN_PROGRESS", "REVIEW", "APPROVED", "DONE"]


@pytest.mark.parametrize("src,dst", [("BACKLOG", "DONE"), ("ASSIGNED", "REVIEW"), ("REVIEW", "DONE"),
                                     ("DONE", "IN_PROGRESS"), ("APPROVED", "IN_PROGRESS")])
def test_invalid_transitions(db, src, dst):
    t = _task(db, status=src)
    with pytest.raises(InvalidTransition):
        transition(db, t, dst, actor="PM")


def test_changes_requested_cycle(db):
    t = _task(db, status="REVIEW")
    transition(db, t, TaskStatus.CHANGES_REQUESTED, actor="PM")
    transition(db, t, TaskStatus.IN_PROGRESS, actor="ARCH")
    transition(db, t, TaskStatus.REVIEW, actor="ARCH")


def test_missing_data_blocks_instead_of_inventing(db):
    t = _task(db, status="ASSIGNED", input_payload={"pains": []})
    run_task(db, t)
    assert t.status == "BLOCKED" and "нет данных" in t.blocked_reason


def test_attempts_cap_escalates(db):
    t = _task(db, status="ASSIGNED", attempts=3)
    run_task(db, t)
    assert t.status == "ESCALATED"


def test_stale_task_escalates(db):
    t = _task(db, status="IN_PROGRESS")
    t.updated_at = utcnow() - timedelta(days=2)
    db.flush()
    out = check_stale(db)
    assert t in out and t.status == "ESCALATED"
