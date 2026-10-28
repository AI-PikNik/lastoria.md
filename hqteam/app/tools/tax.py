"""Налоговое основание (TVA). Ставка применяется только если:
1) в базе знаний есть свежий (≤90 дней) официальный источник FIN/MD по теме, и
2) FIN-HUMAN подтвердил факт (ставку) по этому документу в knowledge_base/fin/tax_facts.json.
Иначе — NEEDS_VERIFICATION, сумма с НДС не считается."""

from __future__ import annotations

import json
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import BASE_DIR, get_settings
from app.core.models import KnowledgeDoc, utcnow
from app.knowledge.citations import NEEDS_VERIFICATION, SOURCED, regulated_finding

TAX_FACTS_PATH = BASE_DIR / "knowledge_base" / "fin" / "tax_facts.json"


def _facts(path: Path) -> list[dict[str, Any]]:
    if not path.exists():
        return []
    return json.loads(path.read_text(encoding="utf-8")).get("facts", [])


def vat_basis(db: Session, *, service_kind: str = "it_services", facts_path: Path = TAX_FACTS_PATH,
              now: datetime | None = None) -> dict[str, Any]:
    now = now or utcnow()
    max_age = timedelta(days=get_settings().legal_source_max_age_days)
    finding = regulated_finding(
        db, topic=f"НДС (TVA): {service_kind}", query="TVA taxa pe valoarea adaugata cota servicii livrare",
        role="FIN", basis="Налоговый кодекс РМ, раздел о TVA (актуальная редакция)",
        conclusion_if_sourced="Источник найден; ставка применяется по факту, подтверждённому FIN-HUMAN.",
        risks=["неверная ставка/место поставки услуги → доначисление и штрафы"],
        human_check=["FIN-HUMAN: подтвердить ставку, место поставки и статус плательщика TVA"],
    ).as_dict()
    if finding["status"] != SOURCED:
        return {**finding, "rate": None}
    for f in _facts(facts_path):
        if f.get("service_kind") != service_kind:
            continue
        confirmed = datetime.fromisoformat(f["confirmed_at"])
        doc = db.execute(select(KnowledgeDoc).where(KnowledgeDoc.checksum == f["source_checksum"])).scalar_one_or_none()
        if doc and doc.source_kind == "official" and now - doc.fetched_at <= max_age and now - confirmed <= max_age:
            return {**finding, "rate": f["rate"], "confirmed_by": f["confirmed_by"],
                    "confirmed_at": f["confirmed_at"], "fact_source": doc.source_url}
    return {**finding, "status": NEEDS_VERIFICATION, "rate": None,
            "conclusion": "Источник есть, но ставка не подтверждена FIN-HUMAN (tax_facts.json) — НДС не начислен."}
