"""Загрузка актуальных текстов нормативных актов из официальных источников.

В коде НЕТ текстов законов и «вечных» редакций. Реестр (knowledge_base/legal/sources.json) хранит
только что проверить и где: название акта, официальный URL, заметки о статусе редакции. Текст
загружается по запросу с разрешённого хоста, фиксируется дата проверки и checksum.
"""

from __future__ import annotations

import html
import json
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

import httpx
from sqlalchemy.orm import Session

from app.core.config import BASE_DIR, get_settings
from app.core.models import KnowledgeDoc, utcnow
from app.knowledge.store import ingest

REGISTRY_PATH = BASE_DIR / "knowledge_base" / "legal" / "sources.json"


@dataclass
class LegalSource:
    key: str
    role: str
    title: str
    url: str
    jurisdiction: str
    status_note: str


def load_registry(path: Path = REGISTRY_PATH) -> list[LegalSource]:
    data = json.loads(path.read_text(encoding="utf-8"))
    return [
        LegalSource(
            key=s["key"],
            role=s.get("role", "LEGAL"),
            title=s["title"],
            url=s.get("url", ""),
            jurisdiction=s.get("jurisdiction", "MD"),
            status_note=s.get("status_note", ""),
        )
        for s in data["sources"]
    ]


def _allowed(url: str) -> bool:
    host = urlparse(url).hostname or ""
    return host in {h.strip() for h in get_settings().legal_fetch_allowed_hosts.split(",")}


def html_to_text(raw: str) -> str:
    raw = re.sub(r"(?is)<(script|style).*?</\1>", " ", raw)
    raw = re.sub(r"(?i)<br\s*/?>|</p>|</div>|</h\d>|</li>", "\n\n", raw)
    txt = html.unescape(re.sub(r"<[^>]+>", " ", raw))
    txt = re.sub(r"[ \t]+", " ", txt)
    return re.sub(r"\n\s*\n\s*(\n\s*)+", "\n\n", txt).strip()


def fetch(
    db: Session, src: LegalSource, *, client: httpx.Client | None = None, version_date: str | None = None
) -> KnowledgeDoc:
    if not src.url:
        raise ValueError(
            f"{src.key}: точный URL акта не задан — юрист должен указать ссылку на карточку акта в реестре"
        )
    if not _allowed(src.url):
        raise ValueError(f"хост {src.url} не в списке официальных источников (HQ_LEGAL_FETCH_ALLOWED_HOSTS)")
    own = client is None
    client = client or httpx.Client(timeout=30.0, follow_redirects=True)
    try:
        r = client.get(src.url, headers={"User-Agent": "HQTeam-KB/0.1 (+legal source verification)"})
        r.raise_for_status()
    finally:
        if own:
            client.close()
    final_url = str(r.url)
    if not _allowed(final_url):
        raise ValueError(f"редирект на неразрешённый хост: {final_url}")
    text = html_to_text(r.text) if "html" in r.headers.get("content-type", "html") else r.text
    if len(text) < 200:
        raise ValueError("получен слишком короткий текст — вероятно, страница-заглушка; проверьте URL вручную")
    return ingest(
        db,
        role=src.role,
        title=src.title,
        text=text,
        source_url=final_url,
        source_kind="official",
        jurisdiction=src.jurisdiction,
        version_date=version_date,
        fetched_at=utcnow(),
        verified=True,  # получено с официального хоста из allowlist; юр. применимость — отдельно человеком
        actor="LEGAL",
    )


def fetch_all(db: Session, role: str | None = None) -> list[dict[str, Any]]:
    out = []
    for src in load_registry():
        if role and src.role != role:
            continue
        try:
            doc = fetch(db, src)
            out.append({"key": src.key, "status": "OK", "doc_id": doc.id, "checked_at": doc.fetched_at.isoformat()})
        except Exception as e:  # noqa: BLE001 - отчёт по каждому источнику
            out.append({"key": src.key, "status": "FAILED", "error": str(e)[:300]})
    return out
