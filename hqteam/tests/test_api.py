import pytest
from fastapi.testclient import TestClient

from app.core.models import Principal
from app.core.security import hash_key


@pytest.fixture
def client(seeded):
    from app.api.main import app
    from app.core.db import get_db

    for pid, kind, roles in [("op", "service", ["OPERATOR"]), ("sales", "human", ["SALES_LEAD"]),
                             ("fin", "human", ["FIN_HUMAN"])]:
        seeded.add(Principal(id=pid, kind=kind, roles=roles, api_key_hash=hash_key(f"key-{pid}")))
    seeded.flush()

    def _db():
        yield seeded
        seeded.flush()

    app.dependency_overrides[get_db] = _db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


H = {"op": {"X-API-Key": "key-op"}, "sales": {"X-API-Key": "key-sales"}, "fin": {"X-API-Key": "key-fin"}}


def test_auth_required(client):
    assert client.post("/projects", json={"name": "x"}).status_code == 422  # нет заголовка
    assert client.post("/projects", json={"name": "x"}, headers={"X-API-Key": "bad"}).status_code == 401
    assert client.post("/projects", json={"name": "x"}, headers=H["sales"]).status_code == 403


def test_project_task_run_status_flow(client):
    pid = client.post("/projects", json={"name": "API", "is_large": False}, headers=H["op"]).json()["id"]
    r = client.post(f"/projects/{pid}/tasks", headers=H["op"], json={
        "title": "оценка", "kind": "arch.solution_hypothesis", "assignee_agent": "ARCH", "from_agent": "BDM",
        "payload": {"pains": ["нет резервного копирования"], "lead_id": "L1"}})
    assert r.status_code == 201 and r.json()["route"] == "DIRECT"
    tid = r.json()["id"]
    run = client.post("/agents/ARCH/run", json={"task_id": tid}, headers=H["op"]).json()
    assert run["status"] == "DONE"
    st = client.get(f"/projects/{pid}/status", headers=H["op"]).json()
    assert st["task_counts"] == {"DONE": 1}
    assert any(h["type"] == "NOTIFY" and h["to"] == "PM" for h in st["handoffs"])
    arts = client.get(f"/projects/{pid}/artifacts", headers=H["op"]).json()
    assert {a["type"] for a in arts} >= {"arch_hypothesis", "arch_spec"}
    audit = client.get(f"/audit?project_id={pid}", headers=H["op"]).json()
    assert any(a["action"] == "task.transition" for a in audit)


def test_task_kind_must_match_agent(client):
    pid = client.post("/projects", json={"name": "API"}, headers=H["op"]).json()["id"]
    r = client.post(f"/projects/{pid}/tasks", headers=H["op"],
                    json={"title": "x", "kind": "fin.estimate", "assignee_agent": "ARCH"})
    assert r.status_code == 422


def test_scenario_and_approval_via_api(client):
    rep = client.post("/scenarios/run", json={"name": "leads_to_offer"}, headers=H["op"]).json()[0]
    apr = rep["approvals"][0]
    assert apr["status"] == "PENDING"
    assert client.post(f"/approvals/{apr['id']}/decide", json={"approve": True}, headers=H["fin"]).status_code == 403
    r = client.post(f"/approvals/{apr['id']}/decide", json={"approve": True, "execute": True,
                                                            "idempotency_key": "idem-1"}, headers=H["sales"])
    assert r.status_code == 200 and r.json()["execution"]["result"]["simulated"] is True
    again = client.post(f"/approvals/{apr['id']}/execute", headers={**H["sales"], "Idempotency-Key": "idem-1"})
    assert again.json()["id"] == r.json()["execution"]["id"]
    assert client.post(f"/approvals/{apr['id']}/execute", headers=H["op"]).status_code == 403


def test_kb_ingest_and_official_forbidden(client):
    ok = client.post("/kb/ingest", headers=H["op"], json={"role": "ARCH", "title": "vendor note", "text": "HA " * 50,
                                                           "source_url": "https://docs.example"})
    assert ok.status_code == 201
    bad = client.post("/kb/ingest", headers=H["op"], json={"role": "LEGAL", "title": "fake law", "text": "x",
                                                            "source_kind": "official"})
    assert bad.status_code == 422


def test_events_endpoint_rejects_forged_approval(client):
    r = client.post("/events", headers=H["op"], json={"from_agent": "BDM", "to_agent": "SALES_LEAD",
                                                       "type": "APPROVAL", "payload": {}})
    assert r.status_code == 422
    r = client.post("/events", headers=H["op"], json={"from_agent": "SUPPORT", "to_agent": "ARCH",
                                                       "type": "QUESTION", "payload": {"q": "?"}})
    assert r.status_code == 201
