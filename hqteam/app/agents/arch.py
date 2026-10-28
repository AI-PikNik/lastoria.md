from __future__ import annotations

import json
from typing import Any

from app.agents.base import AgentOutput, BaseAgent, Ctx, MissingData
from app.core.config import BASE_DIR
from app.tools import diagram
from app.tools.validation import find_hardcoded_secrets, missing_sections

PATTERNS_PATH = BASE_DIR / "knowledge_base" / "arch" / "solution_patterns.json"

BASELINE_SECURITY_BACKUP = [
    "Резервное копирование критичных данных по правилу 3-2-1, минимум одна неизменяемая/офлайн-копия",
    "Регулярный тест восстановления с записью в журнал (бэкап без теста не считается рабочим)",
    "MFA для удалённого и привилегированного доступа, принцип наименьших привилегий",
    "Сегментация сети: пользователи / серверы / управление / гости",
    "Централизованный сбор логов и мониторинг доступности",
]

HLD_REQUIRED = ["Контекст", "Архитектура", "Спецификация ресурсов", "VLAN", "Матрица доступов",
                "Security and Backup", "Мониторинг", "DR", "План миграции", "План отката", "NOT_VERIFIED"]


def load_patterns() -> list[dict[str, Any]]:
    return json.loads(PATTERNS_PATH.read_text(encoding="utf-8"))["patterns"]


def match_patterns(pains: list[str]) -> list[dict[str, Any]]:
    text = " ".join(pains).lower()
    return [p for p in load_patterns() if any(t in text for t in p["triggers"])]


def _accounting_sync(revision: int) -> str:
    if revision >= 2:
        guard = (
            "        cur.execute(\n"
            "            \"INSERT INTO sync_log (idempotency_key, direction, entity, status) \"\n"
            "            \"VALUES (%s, 'in', 'stock', 'received') ON CONFLICT (idempotency_key) DO NOTHING RETURNING id\",\n"
            "            (batch[\"batch_id\"],),\n"
            "        )\n"
            "        if cur.fetchone() is None:\n"
            "            return \"duplicate\"\n"
        )
    else:
        guard = "        pass  # rev1: идемпотентность повторной доставки пакета не реализована\n"
    # текст генерируемого файла для ревью; SQL в нём параметризован (%s), а не собран из данных
    return (
        '"""Синхронизация остатков с учётной системой клиента — ЗАГОТОВКА. NOT_VERIFIED:\n'  # noqa: S608
        'нет доступа, документации API и тестовой базы клиента. Реальный обмен не выполнялся."""\n'
        "import os\n\n"
        'ACCOUNTING_API_URL = os.environ["ACCOUNTING_API_URL"]\n'
        'ACCOUNTING_API_TOKEN = os.environ["ACCOUNTING_API_TOKEN"]\n\n\n'
        "def apply_stock_batch(conn, batch):\n"
        '    """batch: {"batch_id": str, "items": [{"store_code", "sku", "qty"}]}"""\n'
        "    with conn.cursor() as cur:\n"
        + guard +
        '        for it in batch["items"]:\n'
        "            cur.execute(\n"
        '                "UPDATE stock SET qty=%s, updated_at=now() FROM stores s, products p "\n'
        '                "WHERE stock.store_id=s.id AND stock.product_id=p.id AND s.code=%s AND p.sku=%s",\n'
        '                (it["qty"], it["store_code"], it["sku"]),\n'
        "            )\n"
        '    return "applied"\n'
    )


# ---------------------------------------------------------------------------- стенд сценария 2
def scaffold_files(revision: int, stores: int) -> dict[str, str]:
    """Заготовка репозитория для СТЕНДА. Ревизия 1 — минимальная первая итерация; ревизия ≥2 добавляет
    идемпотентность синхронизации остатков и скрипт теста восстановления (результат цикла исправлений)."""
    sync_log = """
-- Идемпотентность синхронизации с учётной системой (rev>=2)
CREATE TABLE sync_log (
    id BIGSERIAL PRIMARY KEY,
    idempotency_key TEXT NOT NULL UNIQUE,
    direction TEXT NOT NULL CHECK (direction IN ('in','out')),
    entity TEXT NOT NULL,
    received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    status TEXT NOT NULL
);
""" if revision >= 2 else ""
    files = {
        "README.md": f"""# AutoParts Moldova — стенд сайта и CRM (заготовка, rev {revision})

Только для СТЕНДА. Не применять к production без ревью и change-процедуры.
Интеграция с учётной системой — NOT_VERIFIED (нет доступа/документации API).

Запуск стенда: `cp .env.example .env && docker compose -f docker-compose.stand.yml up -d`
""",
        ".env.example": """# Все секреты — из secret manager. Здесь только имена переменных.
POSTGRES_DB=autoparts
POSTGRES_USER=autoparts_app
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
API_SECRET_KEY=${API_SECRET_KEY}
ACCOUNTING_API_URL=${ACCOUNTING_API_URL}
ACCOUNTING_API_TOKEN=${ACCOUNTING_API_TOKEN}
""",
        "docker-compose.stand.yml": """services:
  db:
    image: postgres:16
    environment:
      POSTGRES_DB: ${POSTGRES_DB}
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes: ["pgdata:/var/lib/postgresql/data", "./db/migrations:/docker-entrypoint-initdb.d:ro"]
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER}"]
      interval: 10s
  api:
    build: ./api
    environment:
      DATABASE_URL: postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@db/${POSTGRES_DB}
      API_SECRET_KEY: ${API_SECRET_KEY}
    depends_on: {db: {condition: service_healthy}}
    healthcheck:
      test: ["CMD", "curl", "-fsS", "http://localhost:8000/health"]
  web:
    image: nginx:stable
    volumes: ["./config/nginx.conf:/etc/nginx/conf.d/default.conf:ro"]
    ports: ["8080:80"]
    depends_on: [api]
volumes:
  pgdata: {}
""",
        "db/migrations/001_init.sql": f"""-- Схема стенда (PostgreSQL). Мультиязычность ro/ru — отдельные поля.
CREATE TABLE stores (id SERIAL PRIMARY KEY, code TEXT NOT NULL UNIQUE, name TEXT NOT NULL); -- {stores} точек
CREATE TABLE products (
    id BIGSERIAL PRIMARY KEY,
    sku TEXT NOT NULL UNIQUE,
    name_ro TEXT NOT NULL,
    name_ru TEXT NOT NULL,
    brand TEXT, oem_numbers TEXT[], price NUMERIC(12,2)
);
CREATE INDEX products_search_ro ON products USING GIN (to_tsvector('simple', name_ro));
CREATE INDEX products_search_ru ON products USING GIN (to_tsvector('simple', name_ru));
CREATE TABLE stock (
    store_id INT NOT NULL REFERENCES stores(id),
    product_id BIGINT NOT NULL REFERENCES products(id),
    qty INT NOT NULL CHECK (qty >= 0),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (store_id, product_id)
);
CREATE TABLE customers (id BIGSERIAL PRIMARY KEY, full_name TEXT, phone TEXT, email TEXT,
    consent_marketing BOOLEAN NOT NULL DEFAULT false, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE orders (id BIGSERIAL PRIMARY KEY, customer_id BIGINT REFERENCES customers(id),
    store_id INT REFERENCES stores(id), status TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE order_items (order_id BIGINT NOT NULL REFERENCES orders(id), product_id BIGINT NOT NULL
    REFERENCES products(id), qty INT NOT NULL CHECK (qty > 0), price NUMERIC(12,2) NOT NULL,
    PRIMARY KEY (order_id, product_id));
CREATE TABLE crm_stages (id SERIAL PRIMARY KEY, name TEXT NOT NULL UNIQUE, ordinal INT NOT NULL);
CREATE TABLE crm_leads (id BIGSERIAL PRIMARY KEY, customer_id BIGINT REFERENCES customers(id),
    stage_id INT NOT NULL REFERENCES crm_stages(id), store_id INT REFERENCES stores(id), owner_staff_id BIGINT);
CREATE TABLE roles (id SERIAL PRIMARY KEY, code TEXT NOT NULL UNIQUE);
CREATE TABLE staff (id BIGSERIAL PRIMARY KEY, login TEXT NOT NULL UNIQUE, active BOOLEAN NOT NULL DEFAULT true);
-- права сотрудника ограничены точкой: store_id NULL означает доступ ко всем точкам (только HQ-роли)
CREATE TABLE staff_roles (staff_id BIGINT NOT NULL REFERENCES staff(id), role_id INT NOT NULL REFERENCES roles(id),
    store_id INT REFERENCES stores(id), PRIMARY KEY (staff_id, role_id, store_id));
{sync_log}""",
        "integration/accounting_sync.py": _accounting_sync(revision),
        "config/nginx.conf": """server {
    listen 80;
    # На проде: TLS-терминация и WAF (ModSecurity + OWASP CRS или облачный WAF) — выбор в LLD.
    add_header X-Content-Type-Options nosniff;
    add_header X-Frame-Options DENY;
    add_header Referrer-Policy strict-origin-when-cross-origin;
    add_header Content-Security-Policy "default-src 'self'";
    client_max_body_size 5m;
    location /api/ { proxy_pass http://api:8000/; limit_except GET POST PUT DELETE { deny all; } }
    location / { root /usr/share/nginx/html; try_files $uri /index.html; }
}
""",
        "backup/backup.sh": """#!/usr/bin/env bash
# Резервная копия БД стенда. Пароль — из окружения (secret manager), не из файла.
set -euo pipefail
ts=$(date +%Y%m%d-%H%M%S)
pg_dump --format=custom --file="/backups/autoparts-${ts}.dump" "${DATABASE_URL}"
find /backups -name 'autoparts-*.dump' -mtime +14 -delete
""",
        "RUNBOOK.md": """# Runbook стенда
- Проверка здоровья: `docker compose ps`, healthcheck api/db.
- Бэкап: `backup/backup.sh` (ежедневно). Тест восстановления — еженедельно (см. backup/restore_test.sh).
- Инцидент: триаж по SLA-матрице, эскалация L3 → ARCH.
- Любые изменения production — только через change-процедуру и approval.
""",
    }
    if revision >= 2:
        files["backup/restore_test.sh"] = """#!/usr/bin/env bash
# Тест восстановления последнего дампа во временную БД с проверкой количества строк.
set -euo pipefail
latest=$(ls -1t /backups/autoparts-*.dump | head -1)
createdb restore_check
pg_restore --dbname=restore_check "${latest}"
psql -d restore_check -tAc "SELECT count(*) FROM products" | grep -qE '^[0-9]+$'
dropdb restore_check
echo "restore OK: ${latest}"
"""
    return files


class ArchAgent(BaseAgent):
    id = "ARCH"
    title = "Системный архитектор"
    result_contract = {
        "arch.solution_hypothesis": ["solution_titles", "spec_lines", "spec_artifact_id", "security_backup"],
        "arch.hld": ["artifact_id", "stages", "not_verified", "security_backup"],
        "arch.scaffold": ["files", "revision"],
        "arch.bugfix": ["fixed", "revision"],
        "arch.l3_escalation": ["analysis"],
    }

    # ------------------------------------------------------------------ сценарий 1
    def h_solution_hypothesis(self, ctx: Ctx) -> AgentOutput:
        ctx.use("arch.design")
        pains = ctx.task.input_payload.get("pains") or []
        matched = match_patterns(pains)
        if not matched:
            raise MissingData(["понятные технические боли клиента"],
                              [("CLIENT", "Опишите, какие ИТ-проблемы мешают бизнесу (через BDM)")])
        ctx.use("spec.resources")
        spec_lines: list[dict[str, Any]] = []
        for p in matched:
            for ln in p.get("labor", []):
                spec_lines.append({"category": "labor", "item": f"{p['code']}: работы", **ln})
            for ln in p.get("support", []):
                spec_lines.append({"category": "support", "item": f"{p['code']}: поддержка/{ln['period']}", **ln})
            for ln in p.get("licenses", []):
                spec_lines.append({"category": "license", "item": ln["item"], "qty": ln.get("qty", 1),
                                   "unit_price": None})
        assumptions = [a for p in matched for a in p["assumptions"]] + ["оценка до обследования, точность ±40%"]
        risks = [r for p in matched for r in p["risks"]]
        questions = list(dict.fromkeys(q for p in matched for q in p["questions"]))
        sec_backup = list(BASELINE_SECURITY_BACKUP)
        for q in questions:
            ctx.ask("CLIENT", q, "CLIENT_REQUIREMENT")
        md = "# Гипотеза решения (ARCH)\n\n> До обследования. Не является обязательством по срокам/характеристикам.\n\n"
        md += "\n".join(f"## {p['title']}\nКомпоненты: " + "; ".join(p["components"]) for p in matched)
        md += "\n\n## Security and Backup\n" + "\n".join(f"- {x}" for x in sec_backup)
        md += "\n\n## Допущения\n" + "\n".join(f"- {x}" for x in assumptions)
        md += "\n\n## Риски\n" + "\n".join(f"- {x}" for x in risks)
        md += "\n\n## Вопросы клиенту\n" + "\n".join(f"- {x}" for x in questions)
        hyp = ctx.artifact("arch_hypothesis", f"arch_hypothesis_{ctx.task.input_payload.get('lead_id')}", md)
        spec = ctx.artifact("arch_spec", f"arch_spec_{ctx.task.input_payload.get('lead_id')}", spec_lines,
                            ext="json")
        return AgentOutput(summary=f"Гипотеза: {', '.join(p['code'] for p in matched)}", result={
            "patterns": [p["code"] for p in matched], "solution_titles": [p["title"] for p in matched],
            "spec_lines": spec_lines, "spec_artifact_id": spec.id, "hypothesis_artifact_id": hyp.id,
            "assumptions": assumptions, "risks": risks, "client_questions": questions,
            "security_backup": sec_backup}, confidence="low", assumptions=assumptions)

    # ------------------------------------------------------------------ сценарий 2: HLD/LLD
    def h_hld(self, ctx: Ctx) -> AgentOutput:
        ctx.use("arch.design")
        card = ctx.dep_result("bdm.client_card")
        stores, sku = card["stores"], card["sku_count"]
        acc = card["accounting_system"]
        not_verified = [
            f"Интеграция с учётной системой «{acc['name']}»: API/формат обмена не подтверждены (доступ: {acc['api_access']})",
            "Выбор CRM (встроенная в платформу или внешняя) — требует решения заказчика",
            "Фактические объёмы трафика и заказов — нет данных, сайзинг стенда предварительный",
            "Наличие у заказчика площадки/кластера VMware и свободных ресурсов — не обследовано",
            "Платёжный шлюз/онлайн-оплата — требования не получены",
        ]
        ctx.use("diagram.mermaid")
        mer = diagram.flowchart(
            nodes=[{"id": "users", "label": "Покупатели (ro/ru)"}, {"id": "waf", "label": "WAF + reverse proxy"},
                   {"id": "web", "label": "Frontend (SSR)"}, {"id": "api", "label": "Backend API"},
                   {"id": "db", "label": "PostgreSQL (каталог, заказы, CRM)"},
                   {"id": "search", "label": "Поиск по каталогу (FTS PostgreSQL)"},
                   {"id": "sync", "label": "Сервис синхронизации остатков"},
                   {"id": "acc", "label": f"Учётная система ({acc['name']}) — NOT_VERIFIED"},
                   {"id": "stores", "label": f"{stores} точек: сотрудники CRM"},
                   {"id": "bkp", "label": "Резервное копирование + offsite"},
                   {"id": "mon", "label": "Мониторинг и логи"}],
            edges=[("users", "waf", "HTTPS"), ("waf", "web", ""), ("web", "api", "REST"), ("api", "db", ""),
                   ("api", "search", ""), ("sync", "acc", "API/файлы?"), ("sync", "db", "остатки"),
                   ("stores", "waf", "VPN/HTTPS + MFA"), ("db", "bkp", "pg_dump/WAL"), ("api", "mon", "метрики")],
            groups={"VMware vSphere кластер (DMZ / APP / DB VLAN)": ["web", "api", "db", "search", "sync", "mon"]},
        )
        resources = [
            {"vm": "web-01/02", "vlan": "DMZ", "vcpu": 2, "ram_gb": 4, "disk_gb": 40, "note": "2 узла за балансировщиком"},
            {"vm": "api-01/02", "vlan": "APP", "vcpu": 4, "ram_gb": 8, "disk_gb": 40, "note": ""},
            {"vm": "db-01 (+ реплика db-02)", "vlan": "DB", "vcpu": 4, "ram_gb": 16, "disk_gb": 200,
             "note": f"каталог ~{sku} SKU; размер уточнить по выгрузке"},
            {"vm": "sync-01", "vlan": "APP", "vcpu": 2, "ram_gb": 4, "disk_gb": 40, "note": ""},
            {"vm": "mon-01", "vlan": "MGMT", "vcpu": 2, "ram_gb": 8, "disk_gb": 200, "note": "метрики/логи"},
            {"vm": "bkp-01", "vlan": "BKP", "vcpu": 2, "ram_gb": 4, "disk_gb": 1000, "note": "+ внеплощадочная копия"},
        ]
        vlans = [("10", "MGMT", "10.10.10.0/24"), ("20", "DMZ", "10.10.20.0/24"), ("30", "APP", "10.10.30.0/24"),
                 ("40", "DB", "10.10.40.0/24"), ("50", "BKP", "10.10.50.0/24"), ("60", "STORES-VPN", "10.20.0.0/20")]
        access = [("Администратор HQ", "все точки", "CRM, каталог, заказы, отчёты", "MFA"),
                  ("Менеджер точки", "своя точка", "заказы, CRM-лиды точки, остатки (чтение)", "MFA"),
                  ("Продавец", "своя точка", "заказы, карточки клиентов точки", "пароль + SSO"),
                  ("Склад", "своя точка", "остатки (чтение), комплектация заказов", "пароль + SSO"),
                  ("Интеграция (сервис)", "—", "запись остатков через sync", "сервисный токен из secret manager")]
        sec_backup = BASELINE_SECURITY_BACKUP + [
            "WAF перед публичным сайтом, TLS везде, заголовки безопасности",
            "ПДн покупателей: минимизация, доступ по ролям, журналирование доступа, шифрование бэкапов",
            "Секреты — только в secret manager, в репозитории — плейсхолдеры ${VAR}",
        ]
        stages: list[dict[str, Any]] = [
            {"id": "S1", "name": "Обследование и ТЗ", "labor": [("architect", 24, 40), ("project_manager", 16, 24)], "weight": 1},
            {"id": "S2", "name": "Инфраструктура стенда и сети", "labor": [("system_engineer", 32, 56), ("network_engineer", 16, 32)], "weight": 2},
            {"id": "S3", "name": "Каталог, сайт ro/ru, корзина", "labor": [("developer", 200, 320), ("qa_engineer", 40, 64)], "weight": 4},
            {"id": "S4", "name": "CRM и права 15 точек", "labor": [("developer", 120, 200), ("qa_engineer", 24, 40)], "weight": 3},
            {"id": "S5", "name": "Интеграция с учётной системой", "labor": [("developer", 80, 160), ("architect", 16, 24)], "weight": 2},
            {"id": "S6", "name": "Тестирование, безопасность, приёмка", "labor": [("qa_engineer", 40, 64), ("security_engineer", 16, 32), ("project_manager", 16, 24)], "weight": 2},
        ]
        md = f"""# HLD/LLD: сайт + CRM для сети автозапчастей ({stores} точек)

## Контекст и требования
{chr(10).join('- ' + r for r in card['requirements'])}

## Архитектура
```mermaid
{mer}
```

## Спецификация ресурсов (предварительная, стенд/старт)
| ВМ | VLAN | vCPU | RAM, ГБ | Диск, ГБ | Примечание |
|---|---|---|---|---|---|
{chr(10).join(f"| {r['vm']} | {r['vlan']} | {r['vcpu']} | {r['ram_gb']} | {r['disk_gb']} | {r['note']} |" for r in resources)}

Сайзинг — инженерная оценка без нагрузочных данных; подтверждается нагрузочным тестом.

## Сеть: VLAN/IP-план (RFC1918, проект)
| VLAN | Назначение | Подсеть |
|---|---|---|
{chr(10).join(f"| {v} | {n} | {s} |" for v, n, s in vlans)}

## Матрица доступов
| Роль | Область | Права | Аутентификация |
|---|---|---|---|
{chr(10).join(f"| {a} | {b} | {c} | {d} |" for a, b, c, d in access)}

## Security and Backup
{chr(10).join('- ' + x for x in sec_backup)}

## Мониторинг и логирование
- Доступность сайта/API, задержки, ошибки 5xx, лаг синхронизации остатков, заполнение дисков, статус бэкапов.

## DR-план
- Целевые RPO/RTO — предложение для согласования (не обязательство): определить с заказчиком.
- Восстановление: развёртывание ВМ из шаблонов + восстановление БД из последней копии; ежеквартальные учения.

## План миграции
1. Выгрузка каталога и остатков из учётной системы (формат — NOT_VERIFIED). 2. Загрузка на стенд, сверка.
3. Пилот на 1–2 точках. 4. Тиражирование на все {stores} точек.

## План отката
- На каждом шаге сохраняется текущая схема работы точек; откат пилота — отключение точки от CRM без потери данных.

## NOT_VERIFIED / требования к клиенту
{chr(10).join('- ' + x for x in not_verified)}
"""
        miss = missing_sections(md, HLD_REQUIRED)
        if miss:
            raise MissingData([f"раздел HLD: {m}" for m in miss])
        art = ctx.artifact("hld", "hld_lld", md)
        for nv in not_verified:
            ctx.ask("CLIENT", nv, "NOT_VERIFIED")
        if ctx.project:
            ctx.project.tech_lead = "ARCH"
        return AgentOutput(summary="HLD/LLD подготовлен", result={
            "artifact_id": art.id, "stages": [{**s, "labor": [list(x) for x in s["labor"]]} for s in stages],
            "resources": resources, "not_verified": not_verified, "security_backup": sec_backup,
            "mermaid": mer}, assumptions=["сайзинг без нагрузочных данных"], confidence="medium")

    # ------------------------------------------------------------------ сценарий 2: заготовка репозитория
    def _emit_scaffold(self, ctx: Ctx, revision: int) -> list[str]:
        ctx.use("repo.scaffold")
        ctx.use("config.render_for_review")
        from app.core.models import Client

        client = ctx.db.get(Client, ctx.project.client_id) if ctx.project and ctx.project.client_id else None
        stores = (client.profile or {}).get("stores") if client else None
        if not stores:
            raise MissingData(["число точек клиента (карточка клиента)"])
        files = scaffold_files(revision, int(stores))
        leaks = {p: find_hardcoded_secrets(c) for p, c in files.items()}
        leaks = {p: v for p, v in leaks.items() if v}
        if leaks:
            raise MissingData([f"секреты в {p}" for p in leaks])
        ids = []
        for path, content in files.items():
            ext = path.rsplit(".", 1)[-1] if "." in path.rsplit("/", 1)[-1] else "txt"
            art = ctx.artifact("scaffold", f"scaffold/{path}", content, ext=ext,
                               meta={"revision": revision, "apply": "REVIEW_ONLY"})
            ids.append(art.id)
        return ids

    def h_scaffold(self, ctx: Ctx) -> AgentOutput:
        rev = int(ctx.task.input_payload.get("revision", 1))
        ids = self._emit_scaffold(ctx, rev)
        return AgentOutput(summary=f"Заготовка стенда rev {rev}: {len(ids)} файлов (только для ревью)",
                           result={"files": ids, "revision": rev, "applied_to_production": False})

    def h_bugfix(self, ctx: Ctx) -> AgentOutput:
        bugs = ctx.task.input_payload.get("bugs") or []
        if not bugs:
            raise MissingData(["список дефектов"])
        rev = int(ctx.task.input_payload.get("from_revision", 1)) + 1
        ids = self._emit_scaffold(ctx, rev)
        return AgentOutput(summary=f"Исправления в rev {rev}", result={
            "fixed": [b["check"] for b in bugs], "revision": rev, "files": ids, "needs_retest": True})

    def h_l3_escalation(self, ctx: Ctx) -> AgentOutput:
        inc = ctx.task.input_payload
        hits = ctx.kb(" ".join([inc.get("title", ""), *inc.get("symptoms", [])]), ["ARCH", "SUPPORT"], k=3)
        analysis = {
            "hypotheses": ["требуется анализ логов и конфигурации с доступом L3"],
            "kb_refs": [h.title for h in hits],
            "next_steps": ["запросить у клиента read-only доступ к мониторингу",
                           "подготовить план изменения (change) с планом отката — применяет человек"],
            "applied_changes": [],
        }
        return AgentOutput(summary="L3-анализ: план действий без изменений в production",
                           result={"analysis": analysis}, confidence="low")
