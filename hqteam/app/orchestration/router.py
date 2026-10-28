"""Гибридная маршрутизация (раздел 3 ТЗ).

A) крупный/клиентский проект → через PM;
B) мелкая рутинная задача между разрешённой парой агентов → напрямую, PM получает NOTIFY;
C) расходы, scope, безопасность, внешний контакт, документ клиенту → эскалация к PM.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Any

from sqlalchemy.orm import Session

from app.core.audit import audit
from app.core.models import Project, Task, TaskStatus
from app.core.security import AGENT_IDS, can_direct
from app.orchestration.messages import AgentEvent, publish

# Признаки, при которых прямая передача запрещена и нужен PM (п. 3C)
ESCALATION_FLAGS = (
    "touches_budget",
    "external_send",
    "production_infra",
    "client_document",
    "scope_change",
    "security_risk",
    "role_conflict",
)

# Рутинные виды работ, которые допустимо передавать напрямую даже внутри крупного проекта
DIRECT_ROUTINE_KINDS = frozenset(
    {
        "arch.solution_hypothesis",
        "arch.bugfix",
        "arch.l3_escalation",
        "fin.estimate",
        "legal.contract_pack",
        "support.retest",
    }
)


@dataclass
class Routing:
    mode: str  # DIRECT | PM | ESCALATION
    reason: str


def decide(
    *, from_agent: str, to_agent: str, kind: str, project: Project | None, flags: dict[str, Any]
) -> Routing:
    raised = [f for f in ESCALATION_FLAGS if flags.get(f)]
    if raised:
        return Routing("ESCALATION", "признаки эскалации: " + ", ".join(raised))
    if from_agent == "PM":
        return Routing("PM", "задачу назначает PM")
    if from_agent == to_agent:
        return Routing("DIRECT", "собственная следующая задача агента")
    if not can_direct(from_agent, to_agent):
        return Routing("PM", f"пара {from_agent}→{to_agent} не разрешена для прямых передач")
    if project is not None and project.is_large and kind not in DIRECT_ROUTINE_KINDS:
        return Routing("PM", "крупный проект: нерутинная задача идёт через PM")
    return Routing("DIRECT", "мелкая рутинная задача, разрешённая пара агентов")


def handoff(
    db: Session,
    *,
    from_agent: str,
    to_agent: str,
    kind: str,
    title: str,
    project_id: str | None,
    payload: dict[str, Any] | None = None,
    flags: dict[str, Any] | None = None,
    depends_on: list[str] | None = None,
    parent_id: str | None = None,
    input_artifacts: list[str] | None = None,
    priority: int = 3,
    due_at: datetime | None = None,
    assumptions: list[str] | None = None,
) -> tuple[Task, Routing]:
    if to_agent not in AGENT_IDS:
        raise ValueError(f"неизвестный агент {to_agent}")
    flags = flags or {}
    project = db.get(Project, project_id) if project_id else None
    r = decide(from_agent=from_agent, to_agent=to_agent, kind=kind, project=project, flags=flags)
    # DIRECT и PM-назначение — сразу ASSIGNED; запрос через PM от другого агента ждёт PM в BACKLOG;
    # эскалация — ESCALATED, пока PM не примет решение.
    if r.mode == "ESCALATION":
        status = TaskStatus.ESCALATED
    elif r.mode == "PM" and from_agent != "PM":
        status = TaskStatus.BACKLOG
    else:
        status = TaskStatus.ASSIGNED
    task = Task(
        project_id=project_id,
        parent_id=parent_id,
        title=title,
        kind=kind,
        assignee_agent=to_agent,
        created_by=from_agent,
        route="DIRECT" if r.mode == "DIRECT" else "PM",
        status=status.value,
        priority=priority,
        depends_on=depends_on or [],
        input_payload=payload or {},
        input_artifacts=input_artifacts or [],
        flags=flags,
        due_at=due_at,
    )
    db.add(task)
    db.flush()
    audit(
        db,
        from_agent,
        "task.create",
        entity_type="task",
        entity_id=task.id,
        project_id=project_id,
        after={"assignee": to_agent, "kind": kind, "route": r.mode, "status": status.value, "reason": r.reason},
    )
    common: dict[str, Any] = {"project_id": project_id, "task_id": task.id, "deadline": due_at,
                              "assumptions": assumptions or []}
    if r.mode == "DIRECT":
        publish(db, AgentEvent(from_agent=from_agent, to_agent=to_agent, type="REQUEST",
                               payload={"kind": kind, "title": title, **(payload or {})}, **common))
        if from_agent != "PM":
            publish(db, AgentEvent(from_agent=from_agent, to_agent="PM", type="NOTIFY",
                                   payload={"direct_handoff": f"{from_agent}→{to_agent}", "kind": kind,
                                            "title": title, "reason": r.reason}, **common))
    elif r.mode == "PM":
        target = to_agent if from_agent == "PM" else "PM"
        publish(db, AgentEvent(from_agent=from_agent, to_agent=target, type="REQUEST",
                               payload={"kind": kind, "title": title, "assignee": to_agent,
                                        "reason": r.reason}, **common))
    else:
        publish(db, AgentEvent(from_agent=from_agent, to_agent="PM", type="ESCALATION",
                               payload={"kind": kind, "title": title, "assignee": to_agent,
                                        "reason": r.reason}, needs_human=True, **common))
    return task, r
