import pytest

from app.agents.registry import AGENT_CLASSES, get_agent
from app.core.security import (
    FORBIDDEN_ACTIONS,
    POLICIES,
    AgentId,
    PermissionDenied,
    check_action,
    check_tool,
    check_write,
)


def test_seven_agents_with_distinct_prompts_tools_and_rights():
    assert set(AGENT_CLASSES) == {"PM", "LEGAL", "BDM", "MKT", "FIN", "SUPPORT", "ARCH"}
    prompts = {a: get_agent(a).system_prompt for a in AGENT_CLASSES}
    assert len(set(prompts.values())) == 7
    tools = {a: POLICIES[AgentId(a)].tools for a in AGENT_CLASSES}
    assert len({frozenset(v) for v in tools.values()}) == 7
    kinds = [k for c in AGENT_CLASSES.values() for k in c.result_contract]
    assert len(kinds) == len(set(kinds)), "виды задач не должны пересекаться между ролями"


def test_tool_whitelist():
    check_tool("FIN", "pricing.estimate")
    with pytest.raises(PermissionDenied):
        check_tool("ARCH", "pricing.estimate")
    with pytest.raises(PermissionDenied):
        check_tool("BDM", "contract.draft")
    with pytest.raises(PermissionDenied):
        check_tool("SUPPORT", "config.render_for_review")


def test_write_rights():
    check_write("BDM", "leads")
    with pytest.raises(PermissionDenied):
        check_write("MKT", "leads")
    with pytest.raises(PermissionDenied):
        check_write("ARCH", "quotes")


@pytest.mark.parametrize("agent", ["PM", "LEGAL", "BDM", "MKT", "FIN", "SUPPORT", "ARCH"])
@pytest.mark.parametrize("action", sorted(FORBIDDEN_ACTIONS))
def test_level3_forbidden_for_everyone(agent, action):
    with pytest.raises(PermissionDenied):
        check_action(agent, action)


def test_level2_only_requestable_by_owner_role():
    assert check_action("FIN", "issue_invoice") == 2
    assert check_action("BDM", "send_quote") == 2
    with pytest.raises(PermissionDenied):
        check_action("BDM", "issue_invoice")
    with pytest.raises(PermissionDenied):
        check_action("MKT", "send_email")
    assert check_action("ARCH", "write_draft") == 1


def test_ctx_enforces_whitelist_at_runtime(db):
    from app.agents.base import Ctx
    from app.core.llm import LlmClient
    from app.core.models import Task

    t = Task(title="t", kind="mkt.icp", assignee_agent="MKT", created_by="PM")
    db.add(t)
    db.flush()
    ctx = Ctx(db, LlmClient(), get_agent("MKT"), t)
    with pytest.raises(PermissionDenied):
        ctx.use("contract.draft")
    with pytest.raises(PermissionDenied):
        ctx.request_approval("issue_invoice", {})
