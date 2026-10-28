from __future__ import annotations

from typing import Any


def _nid(s: str) -> str:
    return "".join(c if c.isalnum() else "_" for c in s)


def flowchart(nodes: list[dict[str, Any]], edges: list[tuple[str, str, str]], direction: str = "LR",
              groups: dict[str, list[str]] | None = None) -> str:
    """nodes: [{id, label}], edges: [(src, dst, label)], groups: {subgraph title: [node ids]}"""
    lines = [f"flowchart {direction}"]
    grouped = set()
    for title, ids in (groups or {}).items():
        lines.append(f'  subgraph {_nid(title)}["{title}"]')
        for n in nodes:
            if n["id"] in ids:
                lines.append(f'    {_nid(n["id"])}["{n["label"]}"]')
                grouped.add(n["id"])
        lines.append("  end")
    for n in nodes:
        if n["id"] not in grouped:
            lines.append(f'  {_nid(n["id"])}["{n["label"]}"]')
    for s, d, label in edges:
        lines.append(f"  {_nid(s)} -->|{label}| {_nid(d)}" if label else f"  {_nid(s)} --> {_nid(d)}")
    return "\n".join(lines)


def gantt(title: str, activities: list[dict[str, Any]], start: str) -> str:
    lines = ["gantt", f"  title {title}", "  dateFormat YYYY-MM-DD", "  axisFormat %d.%m"]
    for a in activities:
        crit = "crit, " if a.get("critical") else ""
        after = f"after {' '.join(a['deps'])}" if a.get("deps") else start
        lines.append(f"  {a['name']} :{crit}{a['id']}, {after}, {int(a['duration'])}d")
    return "\n".join(lines)
