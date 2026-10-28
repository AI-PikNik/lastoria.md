from decimal import Decimal

import pytest

from app.core.llm import BudgetExceeded, LlmClient
from app.core.logging import mask_pii, mask_text
from app.tools.planning import CycleError, critical_path
from app.tools.pricing import RateCard, estimate, payment_schedule
from app.tools.validation import find_hardcoded_secrets


def test_pii_masking():
    s = mask_text("email ion.popescu@firma.md tel +373 69 123 456 IDNO 1003600012345")
    assert "ion.popescu" not in s and "69 123 456" not in s and "1003600012345" not in s
    assert mask_pii({"contact": {"email": "a.b@c.md"}})["contact"]["email"].startswith("a***@")


def test_audit_masks_pii(db):
    from app.core.audit import audit

    row = audit(db, "BDM", "x", after={"contact": {"email": "secret.person@corp.md"}})
    assert "secret.person" not in str(row.after)


def test_llm_limits_and_cost_journal(db, monkeypatch):
    monkeypatch.setenv("HQ_TASK_MAX_LLM_CALLS", "2")
    from app.core.config import get_settings

    get_settings.cache_clear()
    llm = LlmClient()
    for _ in range(2):
        r = llm.complete(db, agent_id="PM", task_id="t1", system="s", prompt="p")
        assert r.mode == "offline" and r.cost_usd == 0
    with pytest.raises(BudgetExceeded):
        llm.complete(db, agent_id="PM", task_id="t1", system="s", prompt="p")
    assert llm.price(1_000_000, 0) == Decimal(str(get_settings().llm_price_input_per_mtok))


def test_no_hardcoded_api_keys_in_repo():
    import pathlib
    import re

    root = pathlib.Path(__file__).resolve().parents[1]
    pat = re.compile(r"sk-ant-[A-Za-z0-9_-]{10,}")
    for p in root.rglob("*"):
        if p.is_file() and ".venv" not in p.parts and p.suffix in {".py", ".md", ".json", ".yml", ".example", ".toml"}:
            assert not pat.search(p.read_text(encoding="utf-8", errors="ignore")), p


def test_secret_scanner():
    assert find_hardcoded_secrets("DB_PASSWORD=hunter2")
    assert not find_hardcoded_secrets("DB_PASSWORD=${DB_PASSWORD}\nTOKEN = os.environ['TOKEN']")


def test_estimate_separates_one_time_and_recurring_and_licenses():
    rc = RateCard(currency="MDL", rates={"a": Decimal(100)}, target_margin=Decimal("0.3"), is_placeholder=True,
                  note="")
    e = estimate([{"category": "labor", "item": "w", "role": "a", "hours_min": 1, "hours_max": 2},
                  {"category": "support", "item": "s", "role": "a", "hours_min": 10, "hours_max": 10},
                  {"category": "license", "item": "lic", "unit_price": None}], rc)
    assert e["subtotal_excl_vat"] == {"min": "100.00", "max": "200.00"}
    assert e["recurring_monthly_excl_vat"] == {"min": "1000.00", "max": "1000.00"}
    assert e["needs_vendor_quote"] == ["lic"]


def test_payment_schedule_sums_exactly():
    sched = payment_schedule([{"name": "a", "weight": 1}, {"name": "b", "weight": 2}], Decimal("1000.01"),
                             Decimal("0.3"))
    assert sum(Decimal(s["amount"]) for s in sched) == Decimal("1000.01")


def test_placeholder_rate_card_forbidden_in_prod(monkeypatch):
    monkeypatch.setenv("HQ_ENV", "prod")
    from app.core.config import get_settings

    get_settings.cache_clear()
    with pytest.raises(RuntimeError):
        RateCard.load()


def test_critical_path():
    cp = critical_path([{"id": "A", "name": "A", "duration": 2, "deps": []},
                        {"id": "B", "name": "B", "duration": 5, "deps": ["A"]},
                        {"id": "C", "name": "C", "duration": 1, "deps": ["A"]},
                        {"id": "D", "name": "D", "duration": 1, "deps": ["B", "C"]}])
    assert cp["critical_path"] == ["A", "B", "D"] and cp["duration_days"] == 8
    with pytest.raises(CycleError):
        critical_path([{"id": "A", "name": "A", "duration": 1, "deps": ["B"]},
                       {"id": "B", "name": "B", "duration": 1, "deps": ["A"]}])


def test_artifact_versioning(db):
    from app.tools.artifacts import write_artifact

    a1 = write_artifact(db, agent_id="ARCH", project_id=None, task_id=None, type="t", name="n", content="1")
    a1b = write_artifact(db, agent_id="ARCH", project_id=None, task_id=None, type="t", name="n", content="1")
    a2 = write_artifact(db, agent_id="ARCH", project_id=None, task_id=None, type="t", name="n", content="2")
    assert a1.id == a1b.id and a2.version == 2 and a2.agent_id == "ARCH"


def test_support_triage_escalates_l3_directly(db):
    from app.core.models import Task
    from app.orchestration.scheduler import run_until_idle

    t = Task(title="inc", kind="support.triage", assignee_agent="SUPPORT", created_by="PM", status="ASSIGNED",
             input_payload={"title": "Сервер учёта недоступен во всех точках", "affected_scope": "all",
                            "critical_service": True, "observations": ["ping шлюза: OK"]})
    db.add(t)
    db.flush()
    run_until_idle(db)
    assert t.status == "DONE" and t.result["severity"] == "P1"
    l3 = db.get(Task, t.result["l3_task"])
    assert l3.route == "DIRECT" and l3.status == "DONE"
    assert l3.result["analysis"]["applied_changes"] == []
