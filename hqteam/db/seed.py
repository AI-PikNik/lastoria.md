"""Seed: внутренние материалы базы знаний по ролям + bootstrap-принципалы (только dev/test).

Тексты законов НЕ сидируются: они загружаются из официальных источников командой `hqteam kb fetch-legal`.
"""

from __future__ import annotations

import secrets

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import BASE_DIR, get_settings
from app.core.models import Principal
from app.core.security import hash_key
from app.knowledge.store import ingest

KB_DIR = BASE_DIR / "knowledge_base"
ROLE_DIRS = {"pm": "PM", "legal": "LEGAL", "bdm": "BDM", "mkt": "MKT", "fin": "FIN", "support": "SUPPORT",
             "arch": "ARCH"}

DEMO_PRINCIPALS = [
    ("demo-sales-lead", "human", ["SALES_LEAD"]),
    ("demo-legal", "human", ["LEGAL_HUMAN"]),
    ("demo-fin", "human", ["FIN_HUMAN"]),
    ("demo-management", "human", ["MANAGEMENT"]),
    ("demo-marketing", "human", ["MARKETING_LEAD"]),
    ("demo-operator", "service", ["OPERATOR"]),
]


def seed_knowledge(db: Session) -> int:
    n = 0
    for sub, role in ROLE_DIRS.items():
        for path in sorted((KB_DIR / sub).rglob("*.md")):
            kind = "template" if "templates" in path.parts else "internal"
            ingest(db, role=role, title=f"HQTeam: {path.stem}", text=path.read_text(encoding="utf-8"),
                   source_url=f"kb://{path.relative_to(KB_DIR)}", source_kind=kind, jurisdiction=None,
                   version_date=None, license_note="внутренний материал HQTeam")
            n += 1
    return n


def seed_principals(db: Session) -> dict[str, str]:
    """Создаёт демо-принципалов и возвращает их ключи (печатаются один раз). В prod не выполняется."""
    if get_settings().env == "prod":
        return {}
    keys: dict[str, str] = {}
    for pid, kind, roles in DEMO_PRINCIPALS:
        if db.execute(select(Principal).where(Principal.id == pid)).scalar_one_or_none():
            continue
        raw = secrets.token_urlsafe(24)
        db.add(Principal(id=pid, kind=kind, roles=roles, api_key_hash=hash_key(raw)))
        keys[pid] = raw
    boot = get_settings().bootstrap_admin_key
    if boot and not db.get(Principal, "admin"):
        db.add(Principal(id="admin", kind="human", roles=["ADMIN"], api_key_hash=hash_key(boot)))
    db.flush()
    return keys


def run(db: Session) -> dict[str, object]:
    return {"knowledge_docs": seed_knowledge(db), "principal_keys": seed_principals(db)}


if __name__ == "__main__":  # pragma: no cover
    from app.core.db import create_all, session_scope

    create_all()
    with session_scope() as s:
        out = run(s)
    print(out)

