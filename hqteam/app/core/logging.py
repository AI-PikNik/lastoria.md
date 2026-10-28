"""Логирование с маскированием ПДн (email, телефоны, IDNO/IDNP)."""

from __future__ import annotations

import logging
import re
from typing import Any

_EMAIL = re.compile(r"([A-Za-z0-9._%+-])[A-Za-z0-9._%+-]*@([A-Za-z0-9.-]+\.[A-Za-z]{2,})")
_PHONE = re.compile(r"(?<!\d)(\+?\d[\d\s().-]{7,}\d)(?!\d)")
_IDN = re.compile(r"(?<!\d)\d{13}(?!\d)")  # IDNO/IDNP — 13 цифр


def mask_text(s: str) -> str:
    s = _IDN.sub(lambda m: m.group(0)[:3] + "*" * 8 + m.group(0)[-2:], s)
    s = _EMAIL.sub(lambda m: f"{m.group(1)}***@{m.group(2)}", s)
    s = _PHONE.sub(lambda m: re.sub(r"\d", "*", m.group(1)[:-2]) + m.group(1)[-2:], s)
    return s


PII_KEYS = {"email", "phone", "contact", "person", "full_name", "idnp", "address"}


def mask_pii(value: Any, _key: str | None = None) -> Any:
    if isinstance(value, str):
        return mask_text(value)
    if isinstance(value, dict):
        return {k: mask_pii(v, k) for k, v in value.items()}
    if isinstance(value, list):
        return [mask_pii(v, _key) for v in value]
    return value


class PiiMaskingFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        record.msg = mask_text(str(record.msg))
        if record.args:
            record.args = tuple(mask_pii(a) for a in record.args) if isinstance(record.args, tuple) else record.args
        return True


def setup_logging(level: int = logging.INFO) -> None:
    root = logging.getLogger()
    if any(isinstance(f, PiiMaskingFilter) for h in root.handlers for f in h.filters):
        return
    handler = logging.StreamHandler()
    handler.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(name)s: %(message)s"))
    handler.addFilter(PiiMaskingFilter())
    root.addHandler(handler)
    root.setLevel(level)


log = logging.getLogger("hqteam")
