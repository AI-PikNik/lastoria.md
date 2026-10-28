"""Сценарии на синтетических данных. Воспроизводимы: LLM в offline-режиме, отправки — simulate."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from sqlalchemy.orm import Session

from app.approvals import service as approvals
from app.core.config import get_settings
from app.core.models import Task
from app.core.security import Caller
from app.orchestration import router
from app.orchestration.projects import create_project, project_artifacts, project_status
from app.orchestration.scheduler import run_until_idle

DATA = Path(__file__).parent / "data"


def scenario_leads_to_offer(db: Session, *, demo_approve: bool = False) -> dict[str, Any]:
    """Сценарий 1: поиск клиентов и коммерческое предложение."""
    icp = json.loads((DATA / "icp_inputs.json").read_text(encoding="utf-8"))
    p = create_project(db, name="[SYNTH] Лидогенерация и КП", is_large=False, scenario="leads_to_offer")
    t_icp, _ = router.handoff(db, from_agent="PM", to_agent="MKT", kind="mkt.icp", title="ICP и сегменты",
                              project_id=p.id, payload=icp)
    router.handoff(db, from_agent="PM", to_agent="BDM", kind="bdm.leads", title="Лиды и квалификация",
                   project_id=p.id, payload={"leads_file": "scenarios/data/leads_synthetic.json", "max_offers": 1},
                   depends_on=[t_icp.id])
    trace = run_until_idle(db, project_id=p.id)
    sent = _demo_approvals(db, p.id, {"send_quote"}) if demo_approve else []
    return _report(db, p.id, "leads_to_offer", trace, sent)


def scenario_autoparts(db: Session, *, demo_approve: bool = False) -> dict[str, Any]:
    """Сценарий 2: сайт + CRM для сети магазинов автозапчастей."""
    p = create_project(db, name="[SYNTH] AutoParts Moldova: сайт + CRM", is_large=True, scenario="autoparts")
    t_card, _ = router.handoff(db, from_agent="PM", to_agent="BDM", kind="bdm.client_card",
                               title="Карточка клиента и требования", project_id=p.id,
                               payload={"client_file": "scenarios/data/autoparts_client.json"})
    router.handoff(db, from_agent="PM", to_agent="PM", kind="pm.plan", title="Проект: WBS, риски, SLA, задачи",
                   project_id=p.id, depends_on=[t_card.id])
    trace = run_until_idle(db, project_id=p.id)
    sent = _demo_approvals(db, p.id, {"deliver_client_document"}) if demo_approve else []
    return _report(db, p.id, "autoparts", trace, sent)


def _demo_approvals(db: Session, project_id: str, actions: set[str]) -> list[dict[str, Any]]:
    """ТОЛЬКО для демо/тестов: имитирует решение человека с нужной ролью и simulate-отправку."""
    if get_settings().env == "prod":
        raise RuntimeError("demo-approve запрещён в prod")
    out = []
    for a in approvals.pending(db, project_id):
        if a.action_type not in actions:
            continue
        human = Caller(id=f"demo-{a.required_role.lower()}", kind="human", roles=frozenset({a.required_role}))
        approvals.decide(db, a.id, caller=human, approve=True, comment="DEMO: одобрено в тестовом режиме")
        op = approvals.execute(db, a.id, executor="SYSTEM")
        out.append({"approval_id": a.id, "action": a.action_type, "outbox": op.result})
    return out


def _report(db: Session, project_id: str, name: str, trace: list[dict[str, Any]],
            sent: list[dict[str, Any]]) -> dict[str, Any]:
    st = project_status(db, project_id)
    arts = project_artifacts(db, project_id)
    not_done = [t for t in st["tasks"] if t["status"] != "DONE"]
    return {
        "scenario": name,
        "project_id": project_id,
        "steps": trace,
        "task_counts": st["task_counts"],
        "not_done": not_done,
        "artifacts": [f"{a['name']} v{a['version']} ({a['agent']})" for a in arts],
        "approvals": st["approvals"],
        "simulated_sends": sent,
        "open_questions": len(st["open_questions"]),
        "open_questions_by_addressee": _count(st["open_questions"], "to"),
        "handoffs": len(st["handoffs"]),
        "direct_handoffs": sum(1 for h in st["handoffs"] if h["type"] == "NOTIFY"),
        "tasks_total": len(db.query(Task).filter(Task.project_id == project_id).all()),
    }


def _count(rows: list[dict[str, Any]], key: str) -> dict[str, int]:
    out: dict[str, int] = {}
    for r in rows:
        out[r[key]] = out.get(r[key], 0) + 1
    return out


SCENARIOS = {"leads_to_offer": scenario_leads_to_offer, "autoparts": scenario_autoparts}
