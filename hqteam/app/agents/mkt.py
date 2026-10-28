from __future__ import annotations

import json
from decimal import Decimal
from typing import Any

from app.agents.base import AgentOutput, BaseAgent, Ctx, MissingData
from app.core.config import BASE_DIR
from app.core.models import IcpSegment

SERVICES_PATH = BASE_DIR / "knowledge_base" / "bdm" / "services.json"


def match_services(pains: list[str]) -> list[str]:
    services = json.loads(SERVICES_PATH.read_text(encoding="utf-8"))["services"]
    text = " ".join(pains).lower()
    return [s["code"] for s in services if any(k in text for k in s["keywords"])]


class MktAgent(BaseAgent):
    id = "MKT"
    title = "Маркетолог"
    result_contract = {"mkt.icp": ["segments", "artifact_id"]}

    def h_icp(self, ctx: Ctx) -> AgentOutput:
        ctx.use("icp.build")
        p = ctx.task.input_payload
        hyps = p.get("segment_hypotheses") or []
        if not hyps:
            raise MissingData(["гипотезы сегментов (отрасль, размер, боли)"],
                              [("MARKETING_LEAD", "Укажите целевые отрасли и типичные боли для ICP")])
        segments = []
        for h in hyps:
            offers = match_services(h["pains"])
            seg = ctx.add(IcpSegment(project_id=ctx.task.project_id, name=h["name"],
                                     criteria={"sector": h["sector"], "size": h.get("size"),
                                               "geo": h.get("geo", "MD"), "status": "HYPOTHESIS"},
                                     pains=h["pains"], offers=offers), "icp_segments")
            segments.append({"id": seg.id, "name": seg.name, "sector": h["sector"], "offers": offers})
        # CPL/CAC — только по фактическим данным
        ctx.use("metrics.cpl_cac")
        spend, leads, won = p.get("marketing_spend"), p.get("leads_count"), p.get("customers_won")
        metrics: dict[str, Any]
        if spend is not None and leads:
            metrics = {"cpl": str(Decimal(str(spend)) / Decimal(leads)),
                       "cac": str(Decimal(str(spend)) / Decimal(won)) if won else None}
        else:
            metrics = {"status": "NO_DATA", "needed": ["расходы на маркетинг за период", "число лидов",
                                                        "число выигранных клиентов"]}
        kb = ctx.kb("позиционирование tone of voice бизнес-результат", ["MKT"], k=1)
        rows = "\n".join(f"| {s['name']} | {s['sector']} | {', '.join(s['offers']) or '—'} |" for s in segments)
        md = f"""# ICP и сегменты HQTeam

> Статус: HYPOTHESIS. Сегменты сформированы из гипотез команды; рыночная статистика не использовалась
> (данных нет) и не выдумывалась. Требуется валидация на реальных сделках.

| Сегмент | Отрасль | Услуги HQTeam |
|---|---|---|
{rows}

## Боли по сегментам
""" + "\n".join(f"- **{h['name']}**: " + "; ".join(h["pains"]) for h in hyps) + f"""

## Метрики CPL/CAC
{json.dumps(metrics, ensure_ascii=False)}

## Источник позиционирования
{kb[0].title if kb else 'нет в базе знаний'}

## Пояснение
{ctx.narrate("Сформулируй ценностное предложение HQTeam для сегментов: " + ", ".join(s['name'] for s in segments))}
"""
        art = ctx.artifact("icp", "icp_segments", md)
        return AgentOutput(summary=f"Сформировано сегментов: {len(segments)}",
                           result={"segments": segments, "metrics": metrics, "artifact_id": art.id},
                           assumptions=["сегменты — гипотезы без рыночных данных"], confidence="low")
