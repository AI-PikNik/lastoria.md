from __future__ import annotations

from decimal import Decimal
from typing import Any

from app.agents.base import AgentOutput, BaseAgent, Ctx, MissingData
from app.core.models import Invoice, Quote
from app.tools.pricing import MissingRate, RateCard, estimate, money, payment_schedule
from app.tools.tax import vat_basis


def _vat_total(subtotal: Decimal, vat: dict[str, Any]) -> Decimal | None:
    if vat.get("status") != "SOURCED" or vat.get("rate") is None:
        return None
    return money(subtotal * (1 + Decimal(str(vat["rate"]))))


class FinAgent(BaseAgent):
    id = "FIN"
    title = "Финансист / бухгалтер"
    result_contract = {
        "fin.estimate": ["quote_id", "subtotal_excl_vat", "vat_basis"],
        "fin.stage_estimate": ["quote_id", "stages", "payment_schedule", "invoice_ids", "vat_basis"],
    }

    def _rc(self) -> RateCard:
        return RateCard.load()

    def h_estimate(self, ctx: Ctx) -> AgentOutput:
        ctx.use("pricing.estimate")
        arch = ctx.dep_result("arch.solution_hypothesis")
        rc = self._rc()
        try:
            est = estimate(arch["spec_lines"], rc)
        except MissingRate as e:
            raise MissingData([str(e)], [("FIN_HUMAN", str(e))]) from e
        ctx.use("tax.basis")
        vat = vat_basis(ctx.db)
        sub_max = Decimal(est["subtotal_excl_vat"]["max"])
        quote = ctx.add(Quote(project_id=ctx.task.project_id, lead_id=ctx.task.input_payload.get("lead_id"),
                              arch_spec_id=arch.get("spec_artifact_id"), cost_lines=est["lines"], vat_basis=vat,
                              subtotal=sub_max, total=_vat_total(sub_max, vat), currency=est["currency"]), "quotes")
        if vat["status"] != "SOURCED":
            ctx.ask("FIN_HUMAN", "НДС для IT-услуг: загрузить актуальную редакцию НК РМ и подтвердить ставку",
                    "NEEDS_VERIFICATION")
        for item in est["needs_vendor_quote"]:
            ctx.ask("FIN_HUMAN", f"Нужна цена поставщика: {item}", "NEEDS_VENDOR_QUOTE")
        md = self._render(est, vat, title="Смета (черновик)")
        art = ctx.artifact("estimate", f"estimate_{ctx.task.input_payload.get('lead_id')}", md,
                           meta={"quote_id": quote.id})
        return AgentOutput(summary=f"Смета: {est['subtotal_excl_vat']['min']}–{est['subtotal_excl_vat']['max']} "
                                   f"{est['currency']} без НДС; НДС: {vat['status']}",
                           result={"quote_id": quote.id, "artifact_id": art.id, "currency": est["currency"],
                                   "subtotal_excl_vat": est["subtotal_excl_vat"], "sections": est["sections"],
                                   "recurring_monthly_excl_vat": est["recurring_monthly_excl_vat"],
                                   "needs_vendor_quote": est["needs_vendor_quote"], "vat_basis": vat,
                                   "rates_are_placeholder": est["rates_are_placeholder"]},
                           assumptions=["демонстрационный rate card"] if est["rates_are_placeholder"] else [])

    def h_stage_estimate(self, ctx: Ctx) -> AgentOutput:
        ctx.use("pricing.estimate")
        hld = ctx.dep_result("arch.hld")
        rc = self._rc()
        stages_out, all_lines = [], []
        total_max = Decimal(0)
        for st in hld["stages"]:
            lines = [{"category": "labor", "item": f"{st['id']} {st['name']}: {r}", "role": r,
                      "hours_min": a, "hours_max": b} for r, a, b in st["labor"]]
            try:
                e = estimate(lines, rc)
            except MissingRate as ex:
                raise MissingData([str(ex)]) from ex
            stages_out.append({"id": st["id"], "name": st["name"], "weight": st["weight"],
                               "min": e["subtotal_excl_vat"]["min"], "max": e["subtotal_excl_vat"]["max"]})
            all_lines += e["lines"]
            total_max += Decimal(e["subtotal_excl_vat"]["max"])
        advance = Decimal(str(ctx.task.input_payload.get("advance_pct", "0.30")))
        schedule = payment_schedule(stages_out, total_max, advance)
        ctx.use("tax.basis")
        vat = vat_basis(ctx.db)
        quote = ctx.add(Quote(project_id=ctx.task.project_id, cost_lines=all_lines, vat_basis=vat,
                              subtotal=money(total_max), total=_vat_total(total_max, vat),
                              currency=rc.currency), "quotes")
        ctx.use("invoice.draft")
        inv_ids = []
        for pmt in schedule[:1]:  # черновик счёта на аванс; остальные — по мере подписания актов
            inv = ctx.add(Invoice(project_id=ctx.task.project_id, tax_basis=vat, draft_json={
                "type": "DRAFT — не является фискальным документом", "stage": pmt["stage"],
                "amount_excl_vat": pmt["amount"], "currency": rc.currency, "trigger": pmt["trigger"],
                "vat": "NEEDS_VERIFICATION" if vat["status"] != "SOURCED" else vat["rate"]}), "invoices")
            inv_ids.append(inv.id)
        apr = ctx.request_approval("issue_invoice", {"invoice_id": inv_ids[0], "amount": schedule[0]["amount"]},
                                   entity_type="invoice", entity_id=inv_ids[0])
        if vat["status"] != "SOURCED":
            ctx.ask("FIN_HUMAN", "НДС: нет подтверждённой ставки — счёт не может быть выпущен", "NEEDS_VERIFICATION")
        ctx.ask("MANAGEMENT", f"Условие аванса {advance:.0%} — коммерческое допущение, требует согласования",
                "COMMERCIAL")
        md = self._render({"currency": rc.currency, "lines": all_lines, "sections": {},
                           "subtotal_excl_vat": {"min": str(sum(Decimal(s['min']) for s in stages_out)),
                                                 "max": str(money(total_max))},
                           "needs_vendor_quote": [], "rates_are_placeholder": rc.is_placeholder,
                           "rate_card_note": rc.note}, vat, title="Смета по этапам (черновик)")
        md += "\n## Этапы\n| Этап | Мин | Макс |\n|---|---|---|\n" + "\n".join(
            f"| {s['id']} {s['name']} | {s['min']} | {s['max']} |" for s in stages_out)
        md += "\n\n## График платежей (от верхней оценки, без НДС)\n" + "\n".join(
            f"- {p['stage']}: {p['amount']} {rc.currency} — {p['trigger']}" for p in schedule)
        art = ctx.artifact("estimate", "stage_estimate", md, meta={"quote_id": quote.id})
        return AgentOutput(summary=f"Смета по этапам, верхняя оценка {money(total_max)} {rc.currency} без НДС",
                           result={"quote_id": quote.id, "stages": stages_out, "payment_schedule": schedule,
                                   "invoice_ids": inv_ids, "invoice_approval_id": apr.id, "vat_basis": vat,
                                   "artifact_id": art.id}, needs_human=True)

    @staticmethod
    def _render(est: dict[str, Any], vat: dict[str, Any], title: str) -> str:
        rows = "\n".join(
            f"| {ln['category']} | {ln['item']} | {ln.get('role', '')} | "
            f"{ln.get('hours_min', '')}–{ln.get('hours_max', '')} | "
            f"{(str(ln['amount_min']) + '–' + str(ln['amount_max'])) if ln.get('amount_min') else '—'} | "
            f"{ln['status']} |" for ln in est["lines"])
        src = "; ".join(f"{s['title']} ({s['url']}, проверено {s['checked_at']})" for s in vat.get("sources", [])) \
            or "—"
        return f"""# {title}

{'> ⚠ ' + est['rate_card_note'] if est.get('rates_are_placeholder') else ''}

| Раздел | Позиция | Роль | Часы | Сумма, {est['currency']} | Статус |
|---|---|---|---|---|---|
{rows}

**Разовые работы, без НДС:** {est['subtotal_excl_vat']['min']} – {est['subtotal_excl_vat']['max']} {est['currency']}
{('**Поддержка, в месяц, без НДС:** ' + est['recurring_monthly_excl_vat']['min'] + ' – ' + est['recurring_monthly_excl_vat']['max'] + ' ' + est['currency']) if est.get('recurring_monthly_excl_vat', {}).get('max', '0.00') != '0.00' else ''}

## Налоговое основание (TVA)
- Статус: **{vat['status']}**
- Основание: {vat['basis']}
- Источник: {src}
- Вывод: {vat['conclusion']}
- Проверить человеку: {'; '.join(vat['human_check'])}

Лицензии/оборудование без цены поставщика: {', '.join(est['needs_vendor_quote']) or '—'}
"""
