from sqlalchemy import select

from app.agents.pm import pm_triage
from app.core.models import AgentMessage, OpenQuestion, Task
from app.orchestration import router
from app.orchestration.projects import create_project


def _msgs(db, task_id):
    return list(db.execute(select(AgentMessage).where(AgentMessage.task_id == task_id)).scalars())


def test_direct_handoff_notifies_pm_without_blocking(db):
    p = create_project(db, name="small", is_large=False)
    t, r = router.handoff(db, from_agent="BDM", to_agent="ARCH", kind="arch.solution_hypothesis", title="оценка",
                          project_id=p.id)
    assert r.mode == "DIRECT" and t.route == "DIRECT" and t.status == "ASSIGNED"
    types = {(m.to_agent, m.type) for m in _msgs(db, t.id)}
    assert ("ARCH", "REQUEST") in types and ("PM", "NOTIFY") in types


def test_support_to_arch_escalation_is_direct(db):
    t, r = router.handoff(db, from_agent="SUPPORT", to_agent="ARCH", kind="arch.l3_escalation", title="L3",
                          project_id=None)
    assert r.mode == "DIRECT" and t.status == "ASSIGNED"


def test_disallowed_pair_goes_through_pm_backlog(db):
    t, r = router.handoff(db, from_agent="MKT", to_agent="ARCH", kind="arch.solution_hypothesis", title="x",
                          project_id=None)
    assert r.mode == "PM" and t.status == "BACKLOG"
    assert any(m.to_agent == "PM" and m.type == "REQUEST" for m in _msgs(db, t.id))


def test_large_project_non_routine_kind_goes_through_pm(db):
    p = create_project(db, name="big", is_large=True)
    _, r = router.handoff(db, from_agent="BDM", to_agent="ARCH", kind="arch.hld", title="HLD", project_id=p.id)
    assert r.mode == "PM"
    _, r2 = router.handoff(db, from_agent="SUPPORT", to_agent="ARCH", kind="arch.bugfix", title="fix",
                           project_id=p.id)
    assert r2.mode == "DIRECT"


def test_escalation_flags_route_to_pm(db):
    for flag in ("touches_budget", "external_send", "production_infra", "client_document", "scope_change",
                 "security_risk"):
        t, r = router.handoff(db, from_agent="BDM", to_agent="ARCH", kind="arch.solution_hypothesis", title=flag,
                              project_id=None, flags={flag: True})
        assert r.mode == "ESCALATION" and t.status == "ESCALATED", flag
        assert any(m.type == "ESCALATION" and m.to_agent == "PM" and m.needs_human for m in _msgs(db, t.id))


def test_pm_triage_assigns_backlog_and_accepts_safe_escalation_only(db):
    t_backlog, _ = router.handoff(db, from_agent="MKT", to_agent="ARCH", kind="arch.solution_hypothesis",
                                  title="b", project_id=None)
    t_doc, _ = router.handoff(db, from_agent="BDM", to_agent="ARCH", kind="arch.solution_hypothesis", title="doc",
                              project_id=None, flags={"client_document": True})
    t_sec, _ = router.handoff(db, from_agent="BDM", to_agent="ARCH", kind="arch.solution_hypothesis", title="sec",
                              project_id=None, flags={"security_risk": True})
    pm_triage(db)
    assert db.get(Task, t_backlog.id).status == "ASSIGNED"
    assert db.get(Task, t_doc.id).status == "ASSIGNED"
    assert db.get(Task, t_sec.id).status == "ESCALATED"
    q = db.execute(select(OpenQuestion).where(OpenQuestion.task_id == t_sec.id)).scalar_one()
    assert q.addressee == "MANAGEMENT"
    pm_triage(db)  # повтор не плодит вопросы
    assert len(list(db.execute(select(OpenQuestion).where(OpenQuestion.task_id == t_sec.id)).scalars())) == 1


def test_event_schema_validation():
    import pytest
    from pydantic import ValidationError

    from app.orchestration.messages import AgentEvent

    AgentEvent(from_agent="BDM", to_agent="ARCH", type="REQUEST")
    with pytest.raises(ValidationError):
        AgentEvent(from_agent="CEO_BOT", to_agent="ARCH", type="REQUEST")
    with pytest.raises(ValidationError):
        AgentEvent(from_agent="BDM", to_agent="ARCH", type="CHAT")
