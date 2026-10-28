from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from datetime import datetime
from decimal import Decimal
from typing import Any

from fastapi import Depends, FastAPI, Header, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.agents.registry import AGENT_CLASSES, get_agent
from app.approvals import service as approvals
from app.core.config import get_settings
from app.core.db import create_all, get_db
from app.core.logging import mask_pii, setup_logging
from app.core.models import AuditLog, Principal, Project, Task
from app.core.security import Caller, PermissionDenied, hash_key
from app.knowledge.store import ingest
from app.orchestration import router as task_router
from app.orchestration.messages import AgentEvent, publish
from app.orchestration.projects import create_project, project_artifacts, project_status
from app.orchestration.scheduler import is_ready, run_task, run_until_idle


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:  # pragma: no cover - вызывается сервером
    setup_logging()
    if get_settings().env == "dev":  # в test/prod схема ставится миграциями (hqteam db upgrade)
        create_all()
    yield


app = FastAPI(title="HQTeam AI company OS", version="0.1.0", lifespan=lifespan)


def caller(x_api_key: str = Header(..., alias="X-API-Key"), db: Session = Depends(get_db)) -> Caller:
    p = db.execute(select(Principal).where(Principal.api_key_hash == hash_key(x_api_key),
                                           Principal.active.is_(True))).scalar_one_or_none()
    if p is None:
        raise HTTPException(401, "неверный API-ключ")
    return Caller(id=p.id, kind=p.kind, roles=frozenset(p.roles))


def operator(c: Caller = Depends(caller)) -> Caller:
    """Операционные действия (создать проект/задачу, запустить агента) — OPERATOR, MANAGEMENT или ADMIN."""
    if not ({"OPERATOR", "MANAGEMENT", "ADMIN"} & c.roles):
        raise HTTPException(403, "нужна роль OPERATOR/MANAGEMENT/ADMIN")
    return c


# --------------------------------------------------------------------------- schemas
class ProjectIn(BaseModel):
    name: str
    client_id: str | None = None
    is_large: bool = True
    budget: Decimal | None = None


class TaskIn(BaseModel):
    title: str
    kind: str
    assignee_agent: str
    from_agent: str = "PM"
    payload: dict[str, Any] = Field(default_factory=dict)
    flags: dict[str, Any] = Field(default_factory=dict)
    depends_on: list[str] = Field(default_factory=list)
    priority: int = 3
    due_at: datetime | None = None


class RunIn(BaseModel):
    task_id: str | None = None
    until_idle: bool = False


class DecisionIn(BaseModel):
    approve: bool
    comment: str | None = None
    execute: bool = False
    idempotency_key: str | None = None


class KbIn(BaseModel):
    role: str
    title: str
    text: str
    source_url: str | None = None
    source_kind: str = "user"
    jurisdiction: str | None = None
    version_date: str | None = None


class ScenarioIn(BaseModel):
    name: str  # leads_to_offer | autoparts | all
    demo_approve: bool = False


# --------------------------------------------------------------------------- endpoints
@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/agents")
def agents() -> list[dict[str, Any]]:
    from app.core.security import POLICIES, AgentId

    return [{"id": a, "title": c.title, "kinds": sorted(c.result_contract), "tools": sorted(POLICIES[AgentId(a)].tools),
             "may_request": sorted(POLICIES[AgentId(a)].may_request)} for a, c in AGENT_CLASSES.items()]


@app.post("/projects", status_code=201)
def post_project(body: ProjectIn, c: Caller = Depends(operator), db: Session = Depends(get_db)) -> dict[str, Any]:
    p = create_project(db, name=body.name, client_id=body.client_id, is_large=body.is_large, budget=body.budget,
                       actor=f"human:{c.id}")
    return {"id": p.id, "owner_pm": p.owner_pm, "status": p.status}


@app.post("/projects/{project_id}/tasks", status_code=201)
def post_task(project_id: str, body: TaskIn, c: Caller = Depends(operator),
              db: Session = Depends(get_db)) -> dict[str, Any]:
    if db.get(Project, project_id) is None:
        raise HTTPException(404, "проект не найден")
    if body.assignee_agent not in AGENT_CLASSES:
        raise HTTPException(422, "неизвестный агент")
    if not get_agent(body.assignee_agent).supports(body.kind):
        raise HTTPException(422, f"{body.assignee_agent} не выполняет {body.kind}")
    t, r = task_router.handoff(db, from_agent=body.from_agent, to_agent=body.assignee_agent, kind=body.kind,
                               title=body.title, project_id=project_id, payload=body.payload, flags=body.flags,
                               depends_on=body.depends_on, priority=body.priority, due_at=body.due_at)
    return {"id": t.id, "status": t.status, "route": r.mode, "reason": r.reason}


@app.post("/agents/{agent_id}/run")
def run_agent(agent_id: str, body: RunIn, c: Caller = Depends(operator),
              db: Session = Depends(get_db)) -> dict[str, Any]:
    if agent_id not in AGENT_CLASSES:
        raise HTTPException(404, "агент не найден")
    if body.task_id:
        t = db.get(Task, body.task_id)
        if t is None or t.assignee_agent != agent_id:
            raise HTTPException(404, "задача не найдена у этого агента")
        if not is_ready(db, t):
            raise HTTPException(409, f"задача не готова: статус {t.status} или зависимости не выполнены")
        run_task(db, t)
        return {"task_id": t.id, "status": t.status, "result": mask_pii(t.result)}
    rows = [t for t in db.execute(select(Task).where(Task.assignee_agent == agent_id)).scalars() if is_ready(db, t)]
    for t in rows:
        run_task(db, t)
    out: dict[str, Any] = {"ran": [{"task_id": t.id, "status": t.status} for t in rows]}
    if body.until_idle:
        out["trace"] = run_until_idle(db)
    return out


@app.post("/events", status_code=201)
def post_event(ev: AgentEvent, c: Caller = Depends(operator), db: Session = Depends(get_db)) -> dict[str, Any]:
    if ev.from_agent.startswith("human:") and ev.from_agent != f"human:{c.id}":
        raise HTTPException(403, "нельзя отправлять событие от имени другого человека")
    if ev.type == "APPROVAL":
        raise HTTPException(422, "APPROVAL создаётся только через approval-сервис")
    m = publish(db, ev)
    if ev.type == "ESCALATION" and ev.task_id:
        from app.orchestration.escalation import escalate

        t = db.get(Task, ev.task_id)
        if t:
            escalate(db, t, reason=str(ev.payload.get("reason", "эскалация через API")), actor=ev.from_agent
                     if not ev.from_agent.startswith("human:") else "SYSTEM")
    return {"id": m.id}


@app.get("/projects/{project_id}/status")
def get_status(project_id: str, c: Caller = Depends(caller), db: Session = Depends(get_db)) -> dict[str, Any]:
    try:
        return mask_pii(project_status(db, project_id))
    except KeyError as e:
        raise HTTPException(404, "проект не найден") from e


@app.get("/projects/{project_id}/artifacts")
def get_artifacts(project_id: str, c: Caller = Depends(caller), db: Session = Depends(get_db)) -> list[dict]:
    return project_artifacts(db, project_id)


@app.get("/approvals")
def list_approvals(project_id: str | None = None, c: Caller = Depends(caller),
                   db: Session = Depends(get_db)) -> list[dict[str, Any]]:
    return [{"id": a.id, "action_type": a.action_type, "required_role": a.required_role, "status": a.status,
             "requested_by": a.requested_by, "project_id": a.project_id, "payload": mask_pii(a.payload)}
            for a in approvals.pending(db, project_id)]


@app.post("/approvals/{approval_id}/decide")
def decide(approval_id: str, body: DecisionIn, c: Caller = Depends(caller),
           db: Session = Depends(get_db)) -> dict[str, Any]:
    try:
        a = approvals.decide(db, approval_id, caller=c, approve=body.approve, comment=body.comment)
        out: dict[str, Any] = {"id": a.id, "status": a.status, "decided_by": a.decided_by}
        if body.execute and body.approve:
            op = approvals.execute(db, a.id, executor=f"human:{c.id}", idempotency_key=body.idempotency_key)
            out["execution"] = {"id": op.id, "mode": op.mode, "result": op.result}
            out["status"] = a.status
        return out
    except PermissionDenied as e:
        raise HTTPException(403, str(e)) from e
    except approvals.ApprovalError as e:
        raise HTTPException(409, str(e)) from e


@app.post("/approvals/{approval_id}/execute")
def execute(approval_id: str, idempotency_key: str | None = Header(None, alias="Idempotency-Key"),
            c: Caller = Depends(caller), db: Session = Depends(get_db)) -> dict[str, Any]:
    if c.kind != "human":
        raise HTTPException(403, "исполнение внешних операций инициирует человек")
    try:
        op = approvals.execute(db, approval_id, executor=f"human:{c.id}", idempotency_key=idempotency_key)
    except approvals.ApprovalError as e:
        raise HTTPException(409, str(e)) from e
    return {"id": op.id, "mode": op.mode, "result": op.result, "idempotency_key": op.idempotency_key}


@app.post("/kb/ingest", status_code=201)
def kb_ingest(body: KbIn, c: Caller = Depends(operator), db: Session = Depends(get_db)) -> dict[str, Any]:
    if body.source_kind == "official":
        raise HTTPException(422, "official-источники загружаются только загрузчиком legal_sources (с allowlist)")
    try:
        d = ingest(db, role=body.role, title=body.title, text=body.text, source_url=body.source_url,
                   source_kind=body.source_kind, jurisdiction=body.jurisdiction, version_date=body.version_date,
                   actor=f"human:{c.id}")
    except ValueError as e:
        raise HTTPException(422, str(e)) from e
    return {"id": d.id, "checksum": d.checksum, "fetched_at": d.fetched_at.isoformat()}


@app.get("/audit")
def get_audit(project_id: str | None = Query(None), limit: int = 500, c: Caller = Depends(caller),
              db: Session = Depends(get_db)) -> list[dict[str, Any]]:
    q = select(AuditLog).order_by(AuditLog.id)
    if project_id:
        q = q.where(AuditLog.project_id == project_id)
    return [{"id": r.id, "actor": r.actor, "action": r.action, "entity_type": r.entity_type,
             "entity_id": r.entity_id, "before": r.before, "after": r.after, "timestamp": r.timestamp.isoformat()}
            for r in db.execute(q.limit(limit)).scalars()]


@app.post("/scenarios/run")
def run_scenario(body: ScenarioIn, c: Caller = Depends(operator), db: Session = Depends(get_db)) -> Any:
    from scenarios.runner import SCENARIOS

    names = list(SCENARIOS) if body.name == "all" else [body.name]
    if any(n not in SCENARIOS for n in names):
        raise HTTPException(404, f"сценарии: {list(SCENARIOS)} или all")
    return [SCENARIOS[n](db, demo_approve=body.demo_approve) for n in names]

