from sqlalchemy import select

from app.core.models import (
    AgentMessage,
    Approval,
    Artifact,
    Contract,
    Invoice,
    Lead,
    OpenQuestion,
    Quote,
    Task,
)
from app.tools.artifacts import read_artifact
from app.tools.validation import find_hardcoded_secrets
from scenarios.runner import scenario_autoparts, scenario_leads_to_offer


def test_scenario1_leads_to_offer(seeded, outbox):
    db = seeded
    rep = scenario_leads_to_offer(db)
    pid = rep["project_id"]
    assert rep["not_done"] == [], rep["not_done"]
    leads = {lead.company: lead for lead in db.execute(select(Lead).where(Lead.project_id == pid)).scalars()}
    assert all(lead.source for lead in leads.values())
    assert "[SYNTH] Demo NoSource SRL" not in leads  # без источника — отклонён
    assert leads["[SYNTH] Demo Logistic Est SRL"].status == "DO_NOT_CONTACT"
    assert leads["[SYNTH] Demo Retail Nord SRL"].score >= 60
    assert leads["[SYNTH] Demo Retail Nord SRL"].status == "PROPOSAL_DRAFT"
    # прямые передачи BDM→ARCH/FIN/LEGAL с уведомлением PM
    notify = list(db.execute(select(AgentMessage).where(AgentMessage.project_id == pid,
                                                        AgentMessage.type == "NOTIFY")).scalars())
    pairs = {m.payload["direct_handoff"] for m in notify}
    assert {"BDM→ARCH", "BDM→FIN", "BDM→LEGAL"} <= pairs
    direct = list(db.execute(select(Task).where(Task.project_id == pid, Task.route == "DIRECT")).scalars())
    assert {t.assignee_agent for t in direct} >= {"ARCH", "FIN", "LEGAL"}
    # смета: НДС не начислен без источника
    q = db.execute(select(Quote).where(Quote.project_id == pid)).scalar_one()
    assert q.vat_basis["status"] == "NEEDS_VERIFICATION" and q.total is None
    assert any(ln["status"] == "NEEDS_VENDOR_QUOTE" for ln in q.cost_lines)
    # договоры: DRAFT, со структурой вывода
    contracts = list(db.execute(select(Contract).where(Contract.project_id == pid)).scalars())
    assert {c.template for c in contracts} == {"it_services", "sla", "nda"}
    assert all(c.human_status == "DRAFT" for c in contracts)
    f = contracts[0].legal_review["findings"][0]
    assert {"basis", "sources", "checked_at", "conclusion", "risks", "human_check"} <= set(f)
    names = {a.name for a in db.execute(select(Artifact).where(Artifact.project_id == pid)).scalars()}
    assert {"icp_segments", "leads_qualified", f"kp_{q.lead_id}", f"pm_review_{q.lead_id}"} <= names
    kp = db.execute(select(Artifact).where(Artifact.name == f"kp_{q.lead_id}")).scalar_one()
    assert "DRAFT" in read_artifact(kp) and "готов к подписанию" not in read_artifact(kp).replace("не готовы к подписанию", "")
    # approval-гейт: без одобрения ничего не отправлено
    apr = db.execute(select(Approval).where(Approval.project_id == pid)).scalar_one()
    assert apr.action_type == "send_quote" and apr.status == "PENDING"
    assert not outbox.exists() or not list(outbox.iterdir())
    oq = list(db.execute(select(OpenQuestion).where(OpenQuestion.project_id == pid)).scalars())
    assert any(o.category == "CONSENT" for o in oq) and any(o.addressee == "CLIENT" for o in oq)


def test_scenario1_demo_approval_simulates_send(seeded, outbox):
    rep = scenario_leads_to_offer(seeded, demo_approve=True)
    assert rep["simulated_sends"] and len(list(outbox.iterdir())) == 1


def test_scenario2_autoparts(seeded, outbox):
    db = seeded
    rep = scenario_autoparts(db)
    pid = rep["project_id"]
    assert rep["not_done"] == [], rep["not_done"]
    tasks = list(db.execute(select(Task).where(Task.project_id == pid)).scalars())
    kinds = [t.kind for t in tasks]
    for k in ("bdm.client_card", "pm.plan", "arch.hld", "legal.contract_pack", "fin.stage_estimate",
              "pm.schedule", "arch.scaffold", "support.test_run", "arch.bugfix", "support.retest", "pm.acceptance"):
        assert k in kinds, k
    # цикл SUPPORT → ARCH: первый прогон нашёл дефекты, повторный — без FAIL
    first = next(t for t in tasks if t.kind == "support.test_run")
    retest = next(t for t in tasks if t.kind == "support.retest")
    assert first.result["fails"] > 0 and retest.result["fails"] == 0
    assert next(t for t in tasks if t.kind == "arch.bugfix").route == "DIRECT"
    # интеграция не заявлена выполненной
    acc = next(t for t in tasks if t.kind == "pm.acceptance")
    assert any("учётной системой" in x for x in acc.result["not_verified"])
    assert any(c["status"] == "NOT_VERIFIED" for c in retest.result["checks"])
    # артефакты стенда без секретов, ревизия 2 после исправлений
    scaffold = list(db.execute(select(Artifact).where(Artifact.project_id == pid, Artifact.type == "scaffold"))
                    .scalars())
    assert all(not find_hardcoded_secrets(read_artifact(a)) for a in scaffold)
    assert all(a.meta["apply"] == "REVIEW_ONLY" for a in scaffold)
    assert max(a.meta["revision"] for a in scaffold) == 2
    hld = db.execute(select(Artifact).where(Artifact.project_id == pid, Artifact.name == "hld_lld")).scalar_one()
    body = read_artifact(hld)
    assert "## Security and Backup" in body and "```mermaid" in body
    # финансы/юр.: черновики и гейты
    inv = db.execute(select(Invoice).where(Invoice.project_id == pid)).scalar_one()
    assert inv.human_status == "PENDING_HUMAN" and "не является фискальным" in inv.draft_json["type"]
    aprs = {a.action_type: a.status for a in db.execute(select(Approval).where(Approval.project_id == pid)).scalars()}
    assert aprs == {"commit_sla": "PENDING", "issue_invoice": "PENDING", "commit_deadline": "PENDING",
                    "deliver_client_document": "PENDING"}
    assert {c.template for c in db.execute(select(Contract).where(Contract.project_id == pid)).scalars()} == \
        {"contract_work", "sla", "dpa"}
    sched = next(t for t in tasks if t.kind == "pm.schedule")
    assert sched.result["critical_path"][0] == "S1" and sched.result["critical_path"][-1] == "S6"
    assert not outbox.exists() or not list(outbox.iterdir())
