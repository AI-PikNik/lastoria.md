from __future__ import annotations

from functools import lru_cache

from app.agents.arch import ArchAgent
from app.agents.base import BaseAgent
from app.agents.bdm import BdmAgent
from app.agents.fin import FinAgent
from app.agents.legal import LegalAgent
from app.agents.mkt import MktAgent
from app.agents.pm import PmAgent
from app.agents.support import SupportAgent

AGENT_CLASSES: dict[str, type[BaseAgent]] = {
    c.id: c for c in (PmAgent, LegalAgent, BdmAgent, MktAgent, FinAgent, SupportAgent, ArchAgent)
}


@lru_cache
def get_agent(agent_id: str) -> BaseAgent:
    if agent_id not in AGENT_CLASSES:
        raise KeyError(f"неизвестный агент {agent_id}")
    return AGENT_CLASSES[agent_id]()
