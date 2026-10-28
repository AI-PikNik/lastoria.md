"""RAG-база знаний: загрузка, чанкинг, индексация (BM25 в БД), поиск с метаданными источника.

Встроенный BM25 не требует внешних сервисов; адаптер ChromaDB/Qdrant подключается через
VectorBackend (см. docs/ADR.md, ADR-005). Каждый фрагмент несёт: источник, URL, дату загрузки,
юрисдикцию, версию.
"""

from __future__ import annotations

import hashlib
import math
import re
from collections import Counter
from dataclasses import dataclass
from datetime import datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.audit import audit
from app.core.config import get_settings
from app.core.models import KnowledgeChunk, KnowledgeDoc, utcnow

_WORD = re.compile(r"[\wăâîșşțţ]+", re.UNICODE)
STOP = {"и", "в", "на", "по", "с", "для", "не", "что", "the", "of", "and", "to", "a", "in", "si", "și", "de",
        "la", "cu", "o", "un", "pe", "din"}

REGULATED_ROLES = {"LEGAL", "FIN"}  # для них действуют правила свежести и обязательного источника


def tokenize(text: str) -> list[str]:
    toks = []
    for w in _WORD.findall(text.lower()):
        if w in STOP or len(w) < 2:
            continue
        toks.append(w[:7] if len(w) > 7 else w)  # грубый стемминг для ru/ro: усечение
    return toks


def chunk_text(text: str, max_chars: int = 900) -> list[str]:
    paras = [p.strip() for p in re.split(r"\n\s*\n", text) if p.strip()]
    chunks: list[str] = []
    buf = ""
    for p in paras:
        if len(buf) + len(p) + 2 <= max_chars:
            buf = f"{buf}\n\n{p}" if buf else p
            continue
        if buf:
            chunks.append(buf)
        while len(p) > max_chars:
            chunks.append(p[:max_chars])
            p = p[max_chars:]
        buf = p
    if buf:
        chunks.append(buf)
    return chunks


def ingest(
    db: Session,
    *,
    role: str,
    title: str,
    text: str,
    source_url: str | None,
    source_kind: str = "internal",
    jurisdiction: str | None = None,
    version_date: str | None = None,
    fetched_at: datetime | None = None,
    verified: bool = False,
    license_note: str | None = None,
    actor: str = "SYSTEM",
) -> KnowledgeDoc:
    if source_kind not in {"official", "internal", "user", "template"}:
        raise ValueError("source_kind: official|internal|user|template")
    checksum = hashlib.sha256(text.encode()).hexdigest()
    dup = db.execute(
        select(KnowledgeDoc).where(KnowledgeDoc.checksum == checksum, KnowledgeDoc.role == role)
    ).scalar_one_or_none()
    if dup:
        if fetched_at and fetched_at > dup.fetched_at:
            dup.fetched_at = fetched_at  # повторная проверка того же текста обновляет дату проверки
        return dup
    doc = KnowledgeDoc(
        role=role,
        title=title,
        source_url=source_url,
        source_kind=source_kind,
        jurisdiction=jurisdiction,
        version_date=version_date,
        fetched_at=fetched_at or utcnow(),
        checksum=checksum,
        verified=verified,
        license_note=license_note,
    )
    db.add(doc)
    db.flush()
    for i, ch in enumerate(chunk_text(text)):
        db.add(KnowledgeChunk(doc_id=doc.id, role=role, ordinal=i, text=ch, tokens=tokenize(ch)))
    db.flush()
    audit(db, actor, "kb.ingest", entity_type="knowledge_doc", entity_id=doc.id,
          after={"role": role, "title": title, "source_url": source_url, "kind": source_kind})
    return doc


@dataclass
class Hit:
    doc_id: str
    title: str
    source_url: str | None
    source_kind: str
    jurisdiction: str | None
    version_date: str | None
    fetched_at: datetime
    verified: bool
    text: str
    score: float
    stale: bool

    def citation(self) -> dict:
        return {
            "title": self.title,
            "url": self.source_url,
            "source_kind": self.source_kind,
            "jurisdiction": self.jurisdiction,
            "version_date": self.version_date,
            "checked_at": self.fetched_at.date().isoformat(),
            "stale": self.stale,
        }


def search(db: Session, query: str, roles: list[str], k: int = 5, now: datetime | None = None) -> list[Hit]:
    q = tokenize(query)
    if not q:
        return []
    rows = db.execute(
        select(KnowledgeChunk, KnowledgeDoc).join(KnowledgeDoc, KnowledgeDoc.id == KnowledgeChunk.doc_id)
        .where(KnowledgeChunk.role.in_(roles))
    ).all()
    if not rows:
        return []
    n = len(rows)
    avgdl = sum(len(c.tokens) for c, _ in rows) / n or 1.0
    df: Counter[str] = Counter()
    for c, _ in rows:
        df.update(set(c.tokens))
    k1, b = 1.5, 0.75
    now = now or utcnow()
    max_age = timedelta(days=get_settings().legal_source_max_age_days)
    scored: list[Hit] = []
    for c, d in rows:
        tf = Counter(c.tokens)
        dl = len(c.tokens) or 1
        s = 0.0
        for t in q:
            if t not in tf:
                continue
            idf = math.log(1 + (n - df[t] + 0.5) / (df[t] + 0.5))
            s += idf * tf[t] * (k1 + 1) / (tf[t] + k1 * (1 - b + b * dl / avgdl))
        if s <= 0:
            continue
        stale = d.role in REGULATED_ROLES and (now - d.fetched_at) > max_age
        scored.append(Hit(d.id, d.title, d.source_url, d.source_kind, d.jurisdiction, d.version_date,
                          d.fetched_at, d.verified, c.text, s, stale))
    scored.sort(key=lambda h: h.score, reverse=True)
    return scored[:k]
