from __future__ import annotations

import json
import re
from typing import Any

from app.agents.base import AgentOutput, BaseAgent, Ctx, Escalate, MissingData
from app.core.config import BASE_DIR
from app.core.models import Incident
from app.tools.validation import find_hardcoded_secrets

SLA_PATH = BASE_DIR / "knowledge_base" / "support" / "sla_matrix.json"

VERIFIED_STATIC = "VERIFIED_STATIC"  # проверено статическим анализом артефактов стенда
NOT_VERIFIED = "NOT_VERIFIED"  # требует запуска на стенде/доступа клиента
FAIL = "FAIL"
MAX_FIX_CYCLES = 2


def _run_checks(files: dict[str, str], hld: str, stores: int) -> list[dict[str, Any]]:
    sql = files.get("db/migrations/001_init.sql", "")
    res: list[dict[str, Any]] = []

    def add(check: str, area: str, ok: bool | None, evidence: str) -> None:
        status = NOT_VERIFIED if ok is None else (VERIFIED_STATIC if ok else FAIL)
        res.append({"check": check, "area": area, "status": status, "evidence": evidence})

    add("catalog.sku_unique_and_search_index", "каталог",
        "sku TEXT NOT NULL UNIQUE" in sql and "USING GIN" in sql, "001_init.sql: UNIQUE(sku), GIN-индексы ro/ru")
    add("catalog.multilang_ro_ru", "каталог", "name_ro" in sql and "name_ru" in sql, "поля name_ro/name_ru")
    add("order.cart_schema", "корзина/заказ",
        "CREATE TABLE orders" in sql and "REFERENCES orders(id)" in sql and "CHECK (qty > 0)" in sql,
        "orders/order_items с FK и проверкой количества")
    add("stock.sync_idempotency", "синхронизация остатков",
        bool(re.search(r"idempotency_key TEXT NOT NULL UNIQUE", sql)) and
        "ON CONFLICT (idempotency_key)" in files.get("integration/accounting_sync.py", ""),
        "повтор пакета не должен применяться дважды: sync_log + ON CONFLICT")
    add("stock.sync_real_exchange", "синхронизация остатков", None,
        "нет доступа к API учётной системы клиента — реальный обмен не проверялся")
    add("crm.funnel_schema", "CRM-воронка", "crm_stages" in sql and "crm_leads" in sql, "crm_stages/crm_leads")
    add("rbac.store_scoped_roles", "права сотрудников",
        "store_id INT REFERENCES stores(id)" in sql and "staff_roles" in sql and "Менеджер точки" in hld,
        f"staff_roles.store_id + матрица доступов HLD ({stores} точек)")
    add("backup.job_present", "бэкап", "pg_dump" in files.get("backup/backup.sh", ""), "backup.sh")
    add("backup.restore_test_present", "restore", "pg_restore" in files.get("backup/restore_test.sh", ""),
        "restore_test.sh: восстановление во временную БД с проверкой")
    add("backup.restore_executed", "restore", None, "фактическое восстановление требует запуска стенда")
    add("load.catalog_50k", "нагрузка", None, "нагрузочный тест требует развёрнутого стенда и профиля нагрузки")
    leaks = [x for c in files.values() for x in find_hardcoded_secrets(c)]
    add("security.no_hardcoded_secrets", "безопасность", not leaks, "; ".join(leaks) or "секреты параметризованы")
    nginx = files.get("config/nginx.conf", "")
    add("security.headers", "безопасность", "X-Frame-Options" in nginx and "Content-Security-Policy" in nginx,
        "nginx: заголовки безопасности")
    add("security.healthchecks", "надёжность", files.get("docker-compose.stand.yml", "").count("healthcheck") >= 2,
        "healthcheck для db и api")
    return res


class SupportAgent(BaseAgent):
    id = "SUPPORT"
    title = "Инженер поддержки L1/L2"
    result_contract = {
        "support.test_run": ["checks", "artifact_id"],
        "support.retest": ["checks", "artifact_id"],
        "support.triage": ["incident_id", "severity", "diagnostics"],
    }

    def _scaffold(self, ctx: Ctx) -> dict[str, str]:
        from sqlalchemy import func, select

        from app.core.models import Artifact

        sub = select(Artifact.name, func.max(Artifact.version).label("v")).where(
            Artifact.project_id == ctx.task.project_id, Artifact.type == "scaffold").group_by(Artifact.name).subquery()
        rows = ctx.db.execute(select(Artifact).join(sub, (Artifact.name == sub.c.name) & (Artifact.version == sub.c.v))
                              .where(Artifact.project_id == ctx.task.project_id)).scalars()
        files = {a.name.removeprefix("scaffold/"): ctx.read(a.id) for a in rows}
        if not files:
            raise MissingData(["артефакты стенда (ARCH scaffold)"])
        return files

    def _test(self, ctx: Ctx, *, cycle: int) -> AgentOutput:
        ctx.use("testplan.build")
        ctx.use("testplan.run_stand")
        files = self._scaffold(ctx)
        hld_art = ctx.latest_artifact("hld_lld")
        if hld_art is None:
            raise MissingData(["HLD"])
        stores = int(ctx.task.input_payload.get("stores", 15))
        checks = _run_checks(files, ctx.read(hld_art.id), stores)
        fails = [c for c in checks if c["status"] == FAIL]
        nv = [c for c in checks if c["status"] == NOT_VERIFIED]
        rows = "\n".join(f"| {c['area']} | {c['check']} | {c['status']} | {c['evidence']} |" for c in checks)
        md = (f"# Тест-план и прогон (цикл {cycle})\n\n"
              "Метод: статическая проверка артефактов стенда (VERIFIED_STATIC). Проверки, требующие запуска стенда "
              "или доступа клиента, помечены NOT_VERIFIED и НЕ считаются пройденными.\n\n"
              "| Область | Проверка | Статус | Основание |\n|---|---|---|---|\n" + rows)
        art = ctx.artifact("test_report", f"test_report_cycle{cycle}", md)
        next_task = None
        if fails:
            if cycle > MAX_FIX_CYCLES:
                raise Escalate(f"дефекты не устранены за {MAX_FIX_CYCLES} цикла исправлений")
            # ревизия заготовки растёт на 1 за цикл исправлений: цикл N проверяет rev N
            fix = ctx.handoff("ARCH", "arch.bugfix", f"Исправить дефекты стенда (цикл {cycle})",
                              payload={"bugs": fails, "from_revision": cycle})
            next_task = ctx.handoff("SUPPORT", "support.retest", f"Повторный прогон (цикл {cycle + 1})",
                                    payload={"cycle": cycle + 1, "stores": stores}, depends_on=[fix.id])
        for c in nv:
            ctx.ask("CLIENT", f"Для проверки «{c['check']}» нужно: {c['evidence']}", "NOT_VERIFIED")
        return AgentOutput(summary=f"Цикл {cycle}: FAIL {len(fails)}, NOT_VERIFIED {len(nv)}",
                           result={"checks": checks, "fails": len(fails), "not_verified": len(nv),
                                   "artifact_id": art.id, "retest_task": next_task.id if next_task else None})

    def h_test_run(self, ctx: Ctx) -> AgentOutput:
        return self._test(ctx, cycle=1)

    def h_retest(self, ctx: Ctx) -> AgentOutput:
        return self._test(ctx, cycle=int(ctx.task.input_payload.get("cycle", 2)))

    def h_triage(self, ctx: Ctx) -> AgentOutput:
        ctx.use("incident.triage")
        p = ctx.task.input_payload
        sla = json.loads(SLA_PATH.read_text(encoding="utf-8"))["severities"]
        scope, critical = p.get("affected_scope", "single_user"), bool(p.get("critical_service"))
        sev = "P1" if critical and scope == "all" else "P2" if critical else "P3" if scope != "question" else "P4"
        ctx.use("diag.readonly")
        diag = {
            "verified": p.get("observations", []),
            "assumed": p.get("hypotheses", []),
            "needs_access": ["логи сервиса за период инцидента", "доступ read-only к мониторингу"],
            "commands_suggested": ["ping <gateway>", "traceroute <target>", "nslookup <name>", "systemctl status <svc>"],
            "destructive_commands": "запрещены",
        }
        inc = ctx.add(Incident(client_id=p.get("client_id"), project_id=ctx.task.project_id, title=p["title"],
                               severity=sev, diagnostics=diag, status="TRIAGED"), "incidents")
        l3 = None
        if sev in ("P1", "P2") or p.get("needs_l3"):
            l3 = ctx.handoff("ARCH", "arch.l3_escalation", f"L3: {p['title']}",
                             payload={"incident_id": inc.id, **p})
            inc.escalated_to = "ARCH"
        return AgentOutput(summary=f"Инцидент {sev}", result={
            "incident_id": inc.id, "severity": sev, "sla": sla[sev], "diagnostics": diag,
            "l3_task": l3.id if l3 else None})
