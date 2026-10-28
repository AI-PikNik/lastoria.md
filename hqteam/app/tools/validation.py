from __future__ import annotations

import re

_SECRET = re.compile(
    r"(?im)^\s*[\w.-]*(password|passwd|secret|token|api[_-]?key|private[_-]?key)[\w.-]*\s*[:=]\s*(?P<v>.+?)\s*$"
)
_PLACEHOLDER = re.compile(r"^(\$\{[A-Z0-9_]+(:-[^}]*)?\}|\"?\$\{[A-Z0-9_]+\}\"?|<[^>]+>|changeme_in_secret_manager|)$")


def missing_sections(md: str, required: list[str]) -> list[str]:
    heads = {h.strip().lower() for h in re.findall(r"(?m)^#{1,6}\s+(.+)$", md)}
    return [r for r in required if not any(r.lower() in h for h in heads)]


def find_hardcoded_secrets(text: str) -> list[str]:
    """Ищет ключ=значение для секретов, где значение не параметризовано (${VAR}) и не пустое."""
    bad = []
    for m in _SECRET.finditer(text):
        v = m.group("v").strip().strip("'\"")
        from_env = v.startswith(("os.environ", "os.getenv", "env(", "${"))
        if v and not _PLACEHOLDER.match(v) and not from_env and "secret manager" not in v.lower():
            bad.append(m.group(0).strip())
    return bad


def require_keys(obj: dict, keys: list[str]) -> list[str]:
    return [k for k in keys if obj.get(k) in (None, "", [], {})]
