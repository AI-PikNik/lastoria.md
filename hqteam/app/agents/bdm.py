from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from sqlalchemy import select

from app.agents.base import AgentOutput, BaseAgent, Ctx, MissingData
from app.agents.mkt import match_services
from app.core.config import BASE_DIR
from app.core.models import Client, IcpSegment, Lead, Quote

QUALIFY_THRESHOLD = 60


def bant_score(lead: dict[str, Any], offers: list[str]) -> tuple[int, dict[str, Any]]:
    sig = lead.get("signals", {})
    need = min(40, 15 * len(offers))
    budget = 20 if sig.get("budget") else 0
    authority = {"decision_maker": 20, "influencer": 10}.get(sig.get("authority", ""), 0)
    timeline = 20 if sig.get("timeline") else 0
    return need + budget + authority + timeline, {
        "framework": "BANT",
        "need": need, "budget": budget, "authority": authority, "timeline": timeline,
        "matched_services": offers,
    }


class BdmAgent(BaseAgent):
    id = "BDM"
    title = "Business Development Manager"
    result_contract = {
        "bdm.leads": ["leads", "artifact_id"],
        "bdm.assemble_quote": ["quote_id", "artifact_id", "approval_id"],
        "bdm.client_card": ["client_id", "requirements", "artifact_id"],
    }

    # ------------------------------------------------------------------ сценарий 1: лиды
    def h_leads(self, ctx: Ctx) -> AgentOutput:
        ctx.use("lead.import")
        p = ctx.task.input_payload
        path = p.get("leads_file")
        if not path:
            raise MissingData(["файл/список лидов из легального источника"],
                              [("SALES_LEAD", "Предоставьте список лидов с указанием источника каждого контакта")])
        data = json.loads((BASE_DIR / path).read_text(encoding="utf-8"))
        segments = list(ctx.db.execute(
            select(IcpSegment).where(IcpSegment.project_id == ctx.task.project_id)).scalars())
        if not segments:
            raise MissingData(["ICP-сегменты от MKT"])
        accepted, rejected = [], []
        ctx.use("lead.qualify")
        for raw in data["leads"]:
            if not raw.get("source"):
                rejected.append({"company": raw.get("company"), "reason": "не указан источник контакта"})
                continue
            offers = match_services(raw.get("pains", []))
            seg = next((s for s in segments if s.criteria.get("sector") == raw.get("sector")), None)
            score, q = bant_score(raw, offers)
            status = "QUALIFIED" if score >= QUALIFY_THRESHOLD else "NURTURE"
            if raw.get("consent") == "DENIED":
                status = "DO_NOT_CONTACT"
            lead = ctx.add(Lead(project_id=ctx.task.project_id, company=raw["company"], source=raw["source"],
                                url=raw.get("url"), contact=raw.get("contact", {}),
                                consent=raw.get("consent", "UNKNOWN"), segment_id=seg.id if seg else None,
                                pains=raw.get("pains", []), qualification={**q, "segment": seg.name if seg else None},
                                score=score, status=status, is_synthetic=bool(data.get("synthetic"))), "leads")
            accepted.append({"id": lead.id, "company": lead.company, "score": score, "status": status,
                             "consent": lead.consent, "source": lead.source})
        accepted.sort(key=lambda x: x["score"], reverse=True)
        for lead_row in accepted:
            if lead_row["status"] == "QUALIFIED" and lead_row["consent"] != "GRANTED":
                ctx.ask("SALES_LEAD", f"Лид {lead_row['company']}: нет подтверждённого основания для контакта "
                                      "(consent UNKNOWN) — связываться нельзя до проверки", "CONSENT")
        targets = [lead_row for lead_row in accepted
                   if lead_row["status"] == "QUALIFIED" and lead_row["consent"] == "GRANTED"]
        targets = targets[: int(p.get("max_offers", 1))]
        pipelines = [self._start_offer_pipeline(ctx, t["id"]) for t in targets]
        rows = "\n".join(f"| {a['company']} | {a['source']} | {a['consent']} | {a['score']} | {a['status']} |"
                         for a in accepted)
        md = (f"# Лиды и квалификация\n\n> Данные: {data.get('dataset', 'не указано')}\n\n"
              "| Компания | Источник | Согласие | Score (BANT) | Статус |\n|---|---|---|---|---|\n" + rows +
              "\n\n## Отклонены\n" + ("\n".join(f"- {r['company']}: {r['reason']}" for r in rejected) or "—") +
              "\n\n## В работу (КП)\n" + ("\n".join(f"- {t['company']}" for t in targets) or "—"))
        art = ctx.artifact("leads", "leads_qualified", md)
        return AgentOutput(summary=f"Лидов принято {len(accepted)}, отклонено {len(rejected)}, в КП {len(targets)}",
                           result={"leads": accepted, "rejected": rejected, "offers": pipelines,
                                   "artifact_id": art.id}, confidence="medium")

    def _start_offer_pipeline(self, ctx: Ctx, lead_id: str) -> dict[str, str]:
        lead = ctx.db.get(Lead, lead_id)
        assert lead is not None
        base = {"lead_id": lead.id, "company": lead.company, "pains": lead.pains}
        t_arch = ctx.handoff("ARCH", "arch.solution_hypothesis", f"Техоценка для КП: {lead.company}",
                             payload=base, assumptions=["оценка по описанию болей, без обследования"])
        t_fin = ctx.handoff("FIN", "fin.estimate", f"Смета для КП: {lead.company}", payload=base,
                            depends_on=[t_arch.id])
        t_legal = ctx.handoff("LEGAL", "legal.contract_pack", f"Драфт договора/SLA/NDA: {lead.company}",
                              payload={**base, "templates": ["it_services", "sla", "nda"],
                                       "processes_personal_data": None})
        t_quote = ctx.handoff("BDM", "bdm.assemble_quote", f"Сборка КП: {lead.company}", payload=base,
                              depends_on=[t_arch.id, t_fin.id, t_legal.id])
        return {"lead_id": lead.id, "arch": t_arch.id, "fin": t_fin.id, "legal": t_legal.id, "quote": t_quote.id}

    # ------------------------------------------------------------------ сценарий 1: КП
    def h_assemble_quote(self, ctx: Ctx) -> AgentOutput:
        ctx.use("quote.assemble")
        arch = ctx.dep_result("arch.solution_hypothesis")
        fin = ctx.dep_result("fin.estimate")
        legal = ctx.dep_result("legal.contract_pack")
        lead = ctx.db.get(Lead, ctx.task.input_payload["lead_id"])
        if lead is None:
            raise MissingData(["лид"])
        quote = ctx.db.get(Quote, fin["quote_id"])
        if quote is None:
            raise MissingData(["смета FIN"])
        quote.lead_id = lead.id
        sub = fin["subtotal_excl_vat"]
        rec = fin["recurring_monthly_excl_vat"]
        vat = fin["vat_basis"]
        vat_line = (f"НДС: {vat['status']} — {vat.get('conclusion', '')}" if vat["status"] != "SOURCED"
                    else f"НДС по ставке {vat['rate']} (источник: {vat['sources'][0]['url']}, проверено {vat['sources'][0]['checked_at']})")
        md = f"""# Коммерческое предложение (DRAFT)

> **Статус: DRAFT.** Не отправлять клиенту без одобрения SALES_LEAD (approval send_quote).
> Клиент: {lead.company} {'(синтетические данные)' if lead.is_synthetic else ''}

## Ваши задачи
{chr(10).join('- ' + x for x in lead.pains)}

## Предлагаемое решение (гипотеза ARCH, до обследования)
{chr(10).join('- ' + x for x in arch['solution_titles'])}

## Ориентировочная стоимость
- Разовые работы, без НДС: **{sub['min']} – {sub['max']} {fin['currency']}**
- Поддержка по SLA, в месяц, без НДС: **{rec['min']} – {rec['max']} {fin['currency']}**
- Лицензии/оборудование: по предложению поставщика ({len(fin['needs_vendor_quote'])} поз., NEEDS_VENDOR_QUOTE)
- {vat_line}
{'- ⚠ Ставки демонстрационные (синтетический сценарий)' if fin.get('rates_are_placeholder') else ''}

## Допущения
{chr(10).join('- ' + x for x in arch['assumptions'])}

## Что нужно уточнить на обследовании
{chr(10).join('- ' + x for x in arch['client_questions'])}

## Договорные документы
Драфты: {', '.join(legal['templates'])}. Юридическая проверка: {legal['needs_verification']} тем требуют
подтверждения источника/юриста. Документы не готовы к подписанию (нет APPROVED_HUMAN).

## Следующий шаг
Встреча-обследование (60 мин) для уточнения требований.
"""
        art = ctx.artifact("quote", f"kp_{lead.id}", md, meta={"quote_id": quote.id})
        quote.arch_spec_id = arch.get("spec_artifact_id")
        ctx.use("email.draft")
        email = ctx.artifact("email_draft", f"email_kp_{lead.id}",
                             f"Тема: Предложение HQTeam для {lead.company}\n\nЧЕРНОВИК. Не отправлен.\n"
                             f"Кому: {lead.contact.get('email', '<нет контакта>')}\n\nВо вложении — КП (DRAFT).",
                             ext="txt")
        if lead.consent != "GRANTED":
            raise MissingData(["законное основание для контакта"], [("SALES_LEAD", f"Нет согласия: {lead.company}")])
        apr = ctx.request_approval("send_quote", {"lead_id": lead.id, "quote_id": quote.id, "to": "lead.contact"},
                                   entity_type="quote", entity_id=quote.id, artifacts=[art, email])
        ctx.handoff("PM", "pm.sales_review", f"Проверка полноты КП: {lead.company}",
                    payload={"lead_id": lead.id, "quote_id": quote.id, "quote_task": ctx.task.id},
                    flags={"client_document": True}, depends_on=[ctx.task.id])
        lead.status = "PROPOSAL_DRAFT"
        return AgentOutput(summary="КП собрано в статусе DRAFT, запрошено одобрение на отправку",
                           result={"quote_id": quote.id, "artifact_id": art.id, "email_draft_id": email.id,
                                   "approval_id": apr.id, "status": "DRAFT"}, needs_human=True)

    # ------------------------------------------------------------------ сценарий 2: карточка клиента
    def h_client_card(self, ctx: Ctx) -> AgentOutput:
        ctx.use("client.card")
        p = ctx.task.input_payload
        path = p.get("client_file")
        if not path:
            raise MissingData(["данные клиента"])
        d = json.loads(Path(BASE_DIR / path).read_text(encoding="utf-8"))
        if not d.get("consent", {}).get("granted"):
            raise MissingData(["согласие клиента на обработку данных/контакт"],
                              [("SALES_LEAD", "Получите и зафиксируйте согласие клиента")])
        client = ctx.add(Client(name=d["name"], mdn=d.get("idno"), sector=d["sector"], contact_consent=True,
                                consent_source=d["consent"]["source"], is_synthetic=bool(d.get("synthetic")),
                                profile={k: d[k] for k in ("stores", "sku_count", "languages", "accounting_system",
                                                           "stakeholders", "budget_constraints") if k in d}),
                         "clients")
        if ctx.project:
            ctx.project.client_id = client.id
        req = d["requirements"]
        md = f"""# Карточка клиента: {client.name}

> {'СИНТЕТИЧЕСКИЕ данные для сценария.' if client.is_synthetic else ''} Согласие: {d['consent']['source']}

- Отрасль: {client.sector}; точек: {d['stores']}; SKU: ~{d['sku_count']}; языки: {', '.join(d['languages'])}
- Учётная система: {d['accounting_system']['name']} — доступ к API: {d['accounting_system']['api_access']}

## Стейкхолдеры
{chr(10).join(f"- {s['role']}: {s['interest']}" for s in d['stakeholders'])}

## Требования
{chr(10).join('- ' + r for r in req)}

## Бюджетные ограничения
{d['budget_constraints']}
"""
        art = ctx.artifact("client_card", "client_card", md)
        return AgentOutput(summary=f"Карточка клиента {client.name}", result={
            "client_id": client.id, "requirements": req, "stores": d["stores"], "sku_count": d["sku_count"],
            "languages": d["languages"], "accounting_system": d["accounting_system"],
            "budget_constraints": d["budget_constraints"], "artifact_id": art.id})
