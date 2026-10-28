"""RBAC агентов и уровни автономности.

Уровень 1 — агент делает сам. Уровень 2 — только через approval человека нужной роли.
Уровень 3 — запрещено агенту в принципе (нет кода исполнения, только отказ + аудит).
"""

from __future__ import annotations

import hashlib
import hmac
from dataclasses import dataclass, field
from enum import IntEnum, StrEnum


class AgentId(StrEnum):
    PM = "PM"
    LEGAL = "LEGAL"
    BDM = "BDM"
    MKT = "MKT"
    FIN = "FIN"
    SUPPORT = "SUPPORT"
    ARCH = "ARCH"


AGENT_IDS = {a.value for a in AgentId}


class Level(IntEnum):
    AUTONOMOUS = 1
    HUMAN_APPROVAL = 2
    FORBIDDEN = 3


# Действия уровня 2 → роль человека, которая вправе одобрить
APPROVAL_ACTIONS: dict[str, str] = {
    "send_email": "SALES_LEAD",
    "send_quote": "SALES_LEAD",
    "publish_content": "MARKETING_LEAD",
    "issue_contract": "LEGAL_HUMAN",
    "issue_invoice": "FIN_HUMAN",
    "change_budget": "MANAGEMENT",
    "commit_sla": "MANAGEMENT",
    "commit_deadline": "MANAGEMENT",
    "deliver_client_document": "MANAGEMENT",
}

# Действия уровня 3 — запрещены любому агенту
FORBIDDEN_ACTIONS: frozenset[str] = frozenset(
    {
        "apply_prod_config",
        "disable_service",
        "delete_data",
        "grant_access",
        "payment_transaction",
        "sign_e_signature",
        "bypass_access_control",
        "run_destructive_command",
    }
)

HUMAN_ROLES = frozenset(set(APPROVAL_ACTIONS.values()) | {"ADMIN", "OPERATOR"})


def action_level(action: str) -> Level:
    if action in FORBIDDEN_ACTIONS:
        return Level.FORBIDDEN
    if action in APPROVAL_ACTIONS:
        return Level.HUMAN_APPROVAL
    return Level.AUTONOMOUS


@dataclass(frozen=True)
class AgentPolicy:
    agent: AgentId
    tools: frozenset[str]
    # сущности, в которые агент может писать
    writes: frozenset[str]
    # действия уровня 2, которые агент вправе ЗАПРОСИТЬ (исполнение — только после approval)
    may_request: frozenset[str] = field(default_factory=frozenset)
    # кому агент может напрямую (без PM) передавать мелкие задачи
    direct_targets: frozenset[str] = field(default_factory=frozenset)


_COMMON_TOOLS = {"kb.search", "artifact.write", "message.send", "question.raise"}

POLICIES: dict[AgentId, AgentPolicy] = {
    AgentId.PM: AgentPolicy(
        AgentId.PM,
        tools=frozenset(
            _COMMON_TOOLS
            | {"project.create", "task.create", "task.assign", "task.review", "decision.record",
               "plan.critical_path", "approval.request", "artifact.list"}
        ),
        writes=frozenset({"projects", "tasks", "decisions", "artifacts", "open_questions", "approvals"}),
        may_request=frozenset({"change_budget", "commit_sla", "commit_deadline", "deliver_client_document"}),
        direct_targets=frozenset(AGENT_IDS - {"PM"}),
    ),
    AgentId.LEGAL: AgentPolicy(
        AgentId.LEGAL,
        tools=frozenset(_COMMON_TOOLS | {"legal.sources", "legal.cite", "contract.draft", "approval.request"}),
        writes=frozenset({"contracts", "artifacts", "open_questions"}),
        may_request=frozenset({"issue_contract"}),
        direct_targets=frozenset({"ARCH", "FIN"}),
    ),
    AgentId.BDM: AgentPolicy(
        AgentId.BDM,
        tools=frozenset(
            _COMMON_TOOLS
            | {"lead.import", "lead.qualify", "client.card", "quote.assemble", "email.draft", "approval.request"}
        ),
        writes=frozenset({"leads", "clients", "quotes", "artifacts", "open_questions"}),
        may_request=frozenset({"send_email", "send_quote"}),
        direct_targets=frozenset({"ARCH", "LEGAL", "FIN", "MKT"}),
    ),
    AgentId.MKT: AgentPolicy(
        AgentId.MKT,
        tools=frozenset(_COMMON_TOOLS | {"icp.build", "content.plan", "metrics.cpl_cac", "approval.request"}),
        writes=frozenset({"icp_segments", "artifacts", "open_questions"}),
        may_request=frozenset({"publish_content"}),
        direct_targets=frozenset({"BDM"}),
    ),
    AgentId.FIN: AgentPolicy(
        AgentId.FIN,
        tools=frozenset(_COMMON_TOOLS | {"pricing.estimate", "tax.basis", "invoice.draft", "approval.request"}),
        writes=frozenset({"quotes", "invoices", "artifacts", "open_questions"}),
        may_request=frozenset({"issue_invoice"}),
        direct_targets=frozenset({"LEGAL", "BDM"}),
    ),
    AgentId.SUPPORT: AgentPolicy(
        AgentId.SUPPORT,
        tools=frozenset(
            _COMMON_TOOLS | {"incident.triage", "diag.readonly", "testplan.build", "testplan.run_stand"}
        ),
        writes=frozenset({"incidents", "artifacts", "open_questions"}),
        direct_targets=frozenset({"ARCH"}),
    ),
    AgentId.ARCH: AgentPolicy(
        AgentId.ARCH,
        tools=frozenset(
            _COMMON_TOOLS
            | {"arch.design", "diagram.mermaid", "config.render_for_review", "repo.scaffold", "spec.resources"}
        ),
        writes=frozenset({"artifacts", "open_questions"}),
        direct_targets=frozenset({"SUPPORT", "FIN"}),
    ),
}


class PermissionDenied(Exception):
    pass


def check_tool(agent: str, tool: str) -> None:
    pol = POLICIES[AgentId(agent)]
    if tool not in pol.tools:
        raise PermissionDenied(f"{agent} не имеет доступа к инструменту {tool}")


def check_write(agent: str, entity: str) -> None:
    pol = POLICIES[AgentId(agent)]
    if entity not in pol.writes:
        raise PermissionDenied(f"{agent} не вправе изменять {entity}")


def check_action(agent: str, action: str) -> Level:
    """Возвращает уровень. Для уровня 3 — всегда отказ. Для 2 — агент должен иметь право запроса."""
    level = action_level(action)
    if level is Level.FORBIDDEN:
        raise PermissionDenied(f"Действие {action} запрещено агентам (уровень 3)")
    if level is Level.HUMAN_APPROVAL and action not in POLICIES[AgentId(agent)].may_request:
        raise PermissionDenied(f"{agent} не вправе запрашивать {action}")
    return level


def can_direct(src: str, dst: str) -> bool:
    if src not in AGENT_IDS or dst not in AGENT_IDS:
        return False
    return dst in POLICIES[AgentId(src)].direct_targets


# --------------------------------------------------------------------------- API principals


def hash_key(raw: str) -> str:
    return hashlib.sha256(raw.encode()).hexdigest()


def keys_equal(a: str, b: str) -> bool:
    return hmac.compare_digest(a, b)


@dataclass(frozen=True)
class Caller:
    id: str
    kind: str  # human | service
    roles: frozenset[str]

    def has(self, role: str) -> bool:
        # ADMIN управляет доступами, но НЕ одобряет бизнес-действия за другие роли (разделение обязанностей)
        return role in self.roles
