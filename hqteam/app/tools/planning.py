"""Метод критического пути (CPM) для плана-графика PM."""

from __future__ import annotations

from typing import Any


class CycleError(Exception):
    pass


def critical_path(activities: list[dict[str, Any]]) -> dict[str, Any]:
    """activities: [{id, name, duration (дни), deps: [id]}] → ES/EF/LS/LF, резервы, критический путь."""
    by_id = {a["id"]: a for a in activities}
    for a in activities:
        for d in a.get("deps", []):
            if d not in by_id:
                raise KeyError(f"{a['id']}: неизвестная зависимость {d}")
    order: list[str] = []
    state: dict[str, int] = {}

    def visit(n: str) -> None:
        if state.get(n) == 1:
            raise CycleError(f"цикл зависимостей через {n}")
        if state.get(n) == 2:
            return
        state[n] = 1
        for d in by_id[n].get("deps", []):
            visit(d)
        state[n] = 2
        order.append(n)

    for a in activities:
        visit(a["id"])
    es: dict[str, float] = {}
    ef: dict[str, float] = {}
    for n in order:
        es[n] = max((ef[d] for d in by_id[n].get("deps", [])), default=0)
        ef[n] = es[n] + by_id[n]["duration"]
    finish = max(ef.values(), default=0)
    succ: dict[str, list[str]] = {n: [] for n in by_id}
    for a in activities:
        for d in a.get("deps", []):
            succ[d].append(a["id"])
    lf: dict[str, float] = {}
    ls: dict[str, float] = {}
    for n in reversed(order):
        lf[n] = min((ls[s] for s in succ[n]), default=finish)
        ls[n] = lf[n] - by_id[n]["duration"]
    rows = []
    for n in order:
        slack = ls[n] - es[n]
        rows.append({"id": n, "name": by_id[n]["name"], "duration": by_id[n]["duration"], "es": es[n],
                     "ef": ef[n], "ls": ls[n], "lf": lf[n], "slack": slack, "critical": abs(slack) < 1e-9})
    # критический путь — цепочка нулевого резерва от старта к финишу
    path: list[str] = []
    cur = [r["id"] for r in rows if r["critical"] and r["es"] == 0]
    while cur:
        n = cur[0]
        path.append(n)
        cur = [s for s in succ[n] if abs(ls[s] - es[s]) < 1e-9 and abs(es[s] - ef[n]) < 1e-9]
    return {"duration_days": finish, "activities": rows, "critical_path": path}
