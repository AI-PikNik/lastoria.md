import pytest
from sqlalchemy import select

from app.approvals import service
from app.core.models import ExternalOperation, Quote
from app.core.security import Caller, PermissionDenied
from app.tools.artifacts import write_artifact
from tests.conftest import human


def _req(db, **kw):
    q = Quote(cost_lines=[], vat_basis={})
    db.add(q)
    db.flush()
    art = write_artifact(db, agent_id="BDM", project_id=None, task_id=None, type="quote", name="kp", content="v1")
    payload = {"quote_id": q.id, "artifact_checksums": {art.id: art.checksum}, **kw}
    return service.request(db, agent="BDM", action_type="send_quote", payload=payload, entity_type="quote",
                           entity_id=q.id), q, art


def test_request_sets_pending_and_is_idempotent(db):
    a1, q, _ = _req(db)
    assert a1.status == "PENDING" and a1.required_role == "SALES_LEAD"
    assert q.status == "PENDING_HUMAN"
    again = service.request(db, agent="BDM", action_type="send_quote",
                            payload={k: v for k, v in a1.payload.items() if k != "_entity_type"},
                            entity_type="quote", entity_id=q.id)
    assert again.id == a1.id


def test_agent_cannot_decide_and_role_is_checked(db):
    a, _, _ = _req(db)
    with pytest.raises(PermissionDenied):
        service.decide(db, a.id, caller=Caller(id="BDM", kind="service", roles=frozenset({"SALES_LEAD"})),
                       approve=True)
    with pytest.raises(PermissionDenied):
        service.decide(db, a.id, caller=human("FIN_HUMAN"), approve=True)
    with pytest.raises(PermissionDenied):
        service.decide(db, a.id, caller=human("ADMIN"), approve=True)


def test_nothing_external_without_approval(db, outbox):
    a, _, _ = _req(db)
    with pytest.raises(service.ApprovalError):
        service.execute(db, a.id, executor="x")
    assert not outbox.exists() or not list(outbox.iterdir())


def test_rejected_cannot_execute(db):
    a, q, _ = _req(db)
    service.decide(db, a.id, caller=human("SALES_LEAD"), approve=False, comment="нет")
    assert q.status == "REJECTED_HUMAN"
    with pytest.raises(service.ApprovalError):
        service.execute(db, a.id, executor="x")


def test_execute_is_idempotent(db, outbox):
    a, q, _ = _req(db)
    service.decide(db, a.id, caller=human("SALES_LEAD"), approve=True)
    assert q.status == "APPROVED_HUMAN"
    op1 = service.execute(db, a.id, executor="human:t", idempotency_key="k-1")
    op2 = service.execute(db, a.id, executor="human:t", idempotency_key="k-1")
    op3 = service.execute(db, a.id, executor="human:t")  # уже EXECUTED → прежний результат
    assert op1.id == op2.id == op3.id
    assert len(list(outbox.iterdir())) == 1
    assert len(list(db.execute(select(ExternalOperation)).scalars())) == 1
    assert op1.result["simulated"] is True


def test_artifact_changed_after_approval_blocks_execution(db):
    a, _, art = _req(db)
    service.decide(db, a.id, caller=human("SALES_LEAD"), approve=True)
    write_artifact(db, agent_id="BDM", project_id=None, task_id=None, type="quote", name="kp", content="v2 правка")
    with pytest.raises(service.ApprovalError, match="изменён"):
        service.execute(db, a.id, executor="x")


def test_tampered_payload_detected(db):
    a, _, _ = _req(db)
    a.payload = {**a.payload, "to": "attacker@example.org"}
    db.flush()
    with pytest.raises(service.ApprovalError):
        service.decide(db, a.id, caller=human("SALES_LEAD"), approve=True)
