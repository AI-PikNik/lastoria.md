"""Лёгкий встроенный worker: выбирает готовые задачи (зависимости DONE), запускает агента, проводит ревью.

Очередь — таблица tasks (DB-backed). Celery+Redis — опция для прода (docs/ADR.md, ADR-004).
"""

from __future__ import annotations

from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.agents.base import AgentOutput, Ctx, Escalate, MissingData
from app.agents.pm import pm_triage
from app.agents.registry import get_agent
from app.core.audit import audit
from app.core.config import get_settings
from app.core.llm import BudgetExceeded, LlmClient, LlmRefused
from app.core.logging import log
from app.core.models import OpenQuestion, Task, TaskStatus
from app.core.security import PermissionDenied
from app.orchestration.escalation import escalate
from app.orchestration.messages import AgentEvent, publish
from app.orchestration.state_machine import transition

RUNNABLE = (TaskStatus.ASSIGNED.value, TaskStatus.CHANGES_REQUESTED.value)


def is_ready(db: Session, t: Task) -> bool:
    if t.status not in RUNNABLE:
        return False
    for dep in t.depends_on or []:
        d = db.get(Task, dep)
        if d is None or d.status != TaskStatus.DONE.value:
            return False
    if (t.flags or {}).get("wait_for_project") and t.project_id:
        others = db.execute(select(Task).where(Task.project_id == t.project_id, Task.id != t.id,
                                               Task.status != TaskStatus.DONE.value)).scalars().all()
        if others:
            return False
    return True


def run_task(db: Session, task: Task, llm: LlmClient | None = None) -> Task:
    llm = llm or LlmClient()
    s = get_settings()
    agent = get_agent(task.assignee_agent)
    if task.attempts >= s.task_max_attempts:
        return escalate(db, task, reason=f"исчерпано попыток: {task.attempts}")
    task.attempts += 1
    transition(db, task, TaskStatus.IN_PROGRESS, actor=agent.id)
    ctx = Ctx(db, llm, agent, task)
    try:
        with db.begin_nested():
            out = agent.execute(ctx)
    except MissingData as e:
        for addressee, q in e.questions:
            db.add(OpenQuestion(project_id=task.project_id, task_id=task.id, raised_by=agent.id,
                                addressee=addressee, question=q, category="MISSING_DATA"))
        transition(db, task, TaskStatus.BLOCKED, actor=agent.id, reason=str(e))
        publish(db, AgentEvent(from_agent=agent.id, to_agent=task.created_by if task.created_by != agent.id else "PM",
                               project_id=task.project_id, task_id=task.id, type="QUESTION",
                               payload={"missing": e.missing}, needs_human=bool(e.questions)))
        return task
    except (BudgetExceeded, PermissionDenied, LlmRefused, Escalate) as e:
        reason = getattr(e, "reason", None) or f"{type(e).__name__}: {e}"
        audit(db, agent.id, "task.failure", entity_type="task", entity_id=task.id, project_id=task.project_id,
              after={"error": reason})
        return escalate(db, task, reason=reason, actor=agent.id, needs_human=True)
    _complete(db, task, agent.id, out)
    return task


def _complete(db: Session, task: Task, agent_id: str, out: AgentOutput) -> None:
    task.result = {**out.result, "_summary": out.summary}
    task.output_artifacts = out.artifacts
    transition(db, task, TaskStatus.REVIEW, actor=agent_id)
    requester = task.created_by if task.created_by in {"PM", "LEGAL", "BDM", "MKT", "FIN", "SUPPORT", "ARCH"} else "PM"
    publish(db, AgentEvent(from_agent=agent_id, to_agent=requester, project_id=task.project_id, task_id=task.id,
                           type="RESULT", payload={"summary": out.summary}, artifacts=out.artifacts,
                           confidence=out.confidence, assumptions=out.assumptions, needs_human=out.needs_human))
    # Ревьюер: PM для PM-маршрута, заказчик задачи — для прямой передачи. Проверяется контракт результата.
    reviewer = "PM" if task.route == "PM" else requester
    missing = get_agent(agent_id).review(task.kind, out.result)
    if missing:
        transition(db, task, TaskStatus.CHANGES_REQUESTED, actor=reviewer, reason=f"нет полей: {missing}")
        return
    transition(db, task, TaskStatus.APPROVED, actor=reviewer)
    transition(db, task, TaskStatus.DONE, actor=reviewer)


def run_until_idle(db: Session, *, project_id: str | None = None, max_steps: int = 200,
                   llm: LlmClient | None = None) -> list[dict[str, Any]]:
    llm = llm or LlmClient()
    trace: list[dict[str, Any]] = []
    for _ in range(max_steps):
        pm_triage(db)
        q = select(Task).where(Task.status.in_(RUNNABLE))
        if project_id:
            q = q.where(Task.project_id == project_id)
        ready = [t for t in db.execute(q.order_by(Task.priority, Task.created_at)).scalars() if is_ready(db, t)]
        if not ready:
            break
        t = ready[0]
        run_task(db, t, llm)
        db.flush()
        log.info("task %s %s → %s", t.kind, t.id, t.status)
        trace.append({"task_id": t.id, "kind": t.kind, "agent": t.assignee_agent, "status": t.status,
                      "route": t.route})
    return trace
