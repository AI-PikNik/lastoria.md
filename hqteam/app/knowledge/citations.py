"""Политика цитирования для права и налогов.

Юридический/налоговый вывод выдаётся только если найден официальный, проверенный, свежий (≤90 дней)
источник нужной юрисдикции. Иначе — статус NEEDS_VERIFICATION и эскалация человеку.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from sqlalchemy.orm import Session

from app.knowledge.store import Hit, search

NEEDS_VERIFICATION = "NEEDS_VERIFICATION"
SOURCED = "SOURCED"


@dataclass
class SourcedFinding:
    topic: str
    status: str  # SOURCED | NEEDS_VERIFICATION
    basis: str
    sources: list[dict[str, Any]] = field(default_factory=list)
    conclusion: str = ""
    risks: list[str] = field(default_factory=list)
    human_check: list[str] = field(default_factory=list)
    excerpt: str | None = None

    def as_dict(self) -> dict[str, Any]:
        return {
            "topic": self.topic,
            "status": self.status,
            "basis": self.basis,
            "sources": self.sources,
            "checked_at": self.sources[0]["checked_at"] if self.sources else None,
            "conclusion": self.conclusion,
            "risks": self.risks,
            "human_check": self.human_check,
            "excerpt": self.excerpt,
        }


def find_regulated(
    db: Session, *, topic: str, query: str, role: str, jurisdiction: str = "MD", min_score: float = 0.5
) -> tuple[str, list[Hit]]:
    hits = [
        h
        for h in search(db, query, [role], k=8)
        if h.source_kind == "official" and h.verified and h.jurisdiction == jurisdiction and h.score >= min_score
    ]
    fresh = [h for h in hits if not h.stale]
    if not fresh:
        return NEEDS_VERIFICATION, hits
    return SOURCED, fresh[:3]


def regulated_finding(
    db: Session,
    *,
    topic: str,
    query: str,
    role: str,
    basis: str,
    conclusion_if_sourced: str,
    risks: list[str],
    human_check: list[str],
    jurisdiction: str = "MD",
) -> SourcedFinding:
    status, hits = find_regulated(db, topic=topic, query=query, role=role, jurisdiction=jurisdiction)
    if status == NEEDS_VERIFICATION:
        reason = (
            "источник найден, но устарел (>90 дней) — требуется перепроверка"
            if hits
            else "официальный источник в базе знаний не найден"
        )
        return SourcedFinding(
            topic=topic,
            status=NEEDS_VERIFICATION,
            basis=basis,
            sources=[h.citation() for h in hits[:3]],
            conclusion=f"Вывод не формулируется: {reason}.",
            risks=risks,
            human_check=["Загрузить актуальную редакцию акта (hqteam kb fetch-legal)", *human_check],
        )
    return SourcedFinding(
        topic=topic,
        status=SOURCED,
        basis=basis,
        sources=[h.citation() for h in hits],
        conclusion=conclusion_if_sourced,
        risks=risks,
        human_check=human_check,
        excerpt=hits[0].text[:600],
    )
