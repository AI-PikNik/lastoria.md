"""Калькуляция сметы. Деньги — Decimal. Цены лицензий/оборудования не выдумываются: без цены поставщика
строка помечается NEEDS_VENDOR_QUOTE и в итог не входит."""

from __future__ import annotations

import json
from dataclasses import dataclass
from decimal import ROUND_HALF_UP, Decimal
from pathlib import Path
from typing import Any

from app.core.config import BASE_DIR, get_settings

RATE_CARD_PATH = BASE_DIR / "knowledge_base" / "fin" / "rate_card.example.json"

Q = Decimal("0.01")


def money(x: Decimal | float | int | str) -> Decimal:
    return Decimal(str(x)).quantize(Q, rounding=ROUND_HALF_UP)


@dataclass
class RateCard:
    currency: str
    rates: dict[str, Decimal]
    target_margin: Decimal
    is_placeholder: bool
    note: str

    @classmethod
    def load(cls, path: Path = RATE_CARD_PATH) -> RateCard:
        d = json.loads(path.read_text(encoding="utf-8"))
        rc = cls(
            currency=d["currency"],
            rates={k: Decimal(str(v)) for k, v in d["hourly_rates"].items()},
            target_margin=Decimal(str(d["target_margin"])),
            is_placeholder=bool(d.get("is_placeholder", True)),
            note=d.get("note", ""),
        )
        if rc.is_placeholder and get_settings().env == "prod":
            raise RuntimeError("В prod нельзя считать по демонстрационным ставкам: загрузите реальный rate card HQTeam")
        return rc


class MissingRate(Exception):
    pass


def estimate(lines: list[dict[str, Any]], rc: RateCard) -> dict[str, Any]:
    """lines: {category: labor|license|hardware|support, item, role?, hours_min?, hours_max?, qty?, unit_price?}"""
    out_lines: list[dict[str, Any]] = []
    sections: dict[str, dict[str, Decimal]] = {}
    needs_quote: list[str] = []
    missing_roles: set[str] = set()
    for ln in lines:
        cat = ln["category"]
        sec = sections.setdefault(cat, {"min": Decimal(0), "max": Decimal(0)})
        if cat in ("labor", "support"):
            role = ln["role"]
            if role not in rc.rates:
                missing_roles.add(role)
                continue
            rate = rc.rates[role]
            hmin, hmax = Decimal(str(ln["hours_min"])), Decimal(str(ln["hours_max"]))
            amin, amax = money(hmin * rate), money(hmax * rate)
            out_lines.append({**ln, "rate": str(rate), "amount_min": str(amin), "amount_max": str(amax),
                              "status": "CALCULATED"})
            sec["min"] += amin
            sec["max"] += amax
        else:
            price = ln.get("unit_price")
            if price is None:
                needs_quote.append(ln["item"])
                out_lines.append({**ln, "status": "NEEDS_VENDOR_QUOTE", "amount_min": None, "amount_max": None})
                continue
            amt = money(Decimal(str(price)) * Decimal(str(ln.get("qty", 1))))
            out_lines.append({**ln, "amount_min": str(amt), "amount_max": str(amt), "status": "CALCULATED"})
            sec["min"] += amt
            sec["max"] += amt
    if missing_roles:
        raise MissingRate(f"нет ставки для ролей: {sorted(missing_roles)}")
    # разовые работы/поставки и ежемесячная поддержка не суммируются между собой
    one_time = {k: v for k, v in sections.items() if k != "support"}
    cost_min = sum((v["min"] for v in one_time.values()), Decimal(0))
    cost_max = sum((v["max"] for v in one_time.values()), Decimal(0))
    rec = sections.get("support", {"min": Decimal(0), "max": Decimal(0)})
    return {
        "currency": rc.currency,
        "lines": out_lines,
        "sections": {k: {"min": str(money(v["min"])), "max": str(money(v["max"]))} for k, v in sections.items()},
        "subtotal_excl_vat": {"min": str(money(cost_min)), "max": str(money(cost_max))},
        "recurring_monthly_excl_vat": {"min": str(money(rec["min"])), "max": str(money(rec["max"]))},
        "needs_vendor_quote": needs_quote,
        "target_margin": str(rc.target_margin),
        "rates_are_placeholder": rc.is_placeholder,
        "rate_card_note": rc.note,
    }


def payment_schedule(stages: list[dict[str, Any]], total: Decimal, advance_pct: Decimal) -> list[dict[str, Any]]:
    """Аванс + оплата по этапам пропорционально весу этапа. Последний платёж закрывает остаток копеек."""
    total = money(total)
    advance = money(total * advance_pct)
    rest = total - advance
    weight_sum = sum(Decimal(str(s["weight"])) for s in stages)
    sched = [{"stage": "Аванс", "amount": str(advance), "trigger": "подписание договора"}]
    acc = Decimal(0)
    for i, s in enumerate(stages):
        amt = money(rest * Decimal(str(s["weight"])) / weight_sum) if i < len(stages) - 1 else money(rest - acc)
        acc += amt
        sched.append({"stage": s["name"], "amount": str(amt), "trigger": f"подписание акта этапа «{s['name']}»"})
    return sched
