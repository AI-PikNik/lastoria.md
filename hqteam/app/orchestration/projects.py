from __future__ import annotations

from decimal import Decimal
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.audit import audit
from app.core.models import AgentMessage, Approval, Artifact, OpenQuestion, Project, Task
from app.core.security import check_tool


def create_project(
    db: Session,
    *,
    name: str,
    client_id: str | None = None,
    is_large: bool = True,
    budget: Decimal | None = None,
    scenario: str | None = None,
    actor: str = "PM",
) -> Project:
    """Проекты создаёт только PM (п. 3A)."""
    check_tool("PM", "project.create")
    p = Project(name=name, client_id=client_id, is_large=is_large, budget=budget, scenario=scenario, owner_pm="PM")
    db.add(p)
    db.flush()
    audit(db, actor, "project.create", entity_type="project", entity_id=p.id, project_id=p.id,
          after={"name": name, "is_large": is_large, "budget": str(budget) if budget is not None else None})
    return p


def project_status(db: Session, project_id: str) -> dict[str, Any]:
    p = db.get(Project, project_id)
    if p is None:
        raise KeyError(project_id)
    tasks = list(db.execute(select(Task).where(Task.project_id == project_id).order_by(Task.created_at)).scalars())
    counts: dict[str, int] = {}
    for t in tasks:
        counts[t.status] = counts.get(t.status, 0) + 1
    blocked = [{"task_id": t.id, "title": t.title, "assignee": t.assignee_agent, "status": t.status,
                "reason": t.blocked_reason or (t.flags or {}).get("escalation_reason")}
               for t in tasks if t.status in ("BLOCKED", "ESCALATED")]
    approvals = list(db.execute(select(Approval).where(Approval.project_id == project_id)).scalars())
    questions = list(db.execute(select(OpenQuestion).where(OpenQuestion.project_id == project_id,
                                                           OpenQuestion.status == "OPEN")).scalars())
    msgs = db.execute(select(AgentMessage).where(AgentMessage.project_id == project_id)).scalars().all()
    return {
        "project": {"id": p.id, "name": p.name, "status": p.status, "owner_pm": p.owner_pm,
                    "tech_lead": p.tech_lead, "is_large": p.is_large, "client_id": p.client_id, "sla": p.sla},
        "task_counts": counts,
        "tasks": [{"id": t.id, "kind": t.kind, "title": t.title, "assignee": t.assignee_agent,
                   "created_by": t.created_by, "route": t.route, "status": t.status, "depends_on": t.depends_on}
                  for t in tasks],
        "blocked": blocked,
        "approvals": [{"id": a.id, "action": a.action_type, "required_role": a.required_role, "status": a.status,
                       "requested_by": a.requested_by} for a in approvals],
        "open_questions": [{"id": q.id, "to": q.addressee, "category": q.category, "question": q.question}
                           for q in questions],
        "handoffs": [{"from": m.from_agent, "to": m.to_agent, "type": m.type, "task_id": m.task_id}
                     for m in msgs],
    }


def project_artifacts(db: Session, project_id: str) -> list[dict[str, Any]]:
    arts = db.execute(select(Artifact).where(Artifact.project_id == project_id)
                      .order_by(Artifact.name, Artifact.version)).scalars()
    return [{"id": a.id, "name": a.name, "type": a.type, "version": a.version, "agent": a.agent_id,
             "path": a.path, "checksum": a.checksum, "status": a.status} for a in arts]
