# HQTeam AI company OS

Система из 7 ИИ-агентов IT-компании HQTeam (Республика Молдова): PM, LEGAL, BDM, MKT, FIN, SUPPORT, ARCH.
Агенты работают через общую БД и API: оркестрация, RBAC, state machine задач, артефакты с версиями,
журнал решений и аудит, approval-гейты человека, RAG с обязательным цитированием для права и налогов.

- Архитектура, дерево файлов, схема БД: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- Решения и допущения: [docs/ADR.md](docs/ADR.md)
- Операционный runbook: [docs/RUNBOOK.md](docs/RUNBOOK.md)
- Что реализовано и что требует реальных доступов: [docs/REPORT.md](docs/REPORT.md)

## Установка

```bash
cd hqteam
python3.11 -m venv .venv
.venv/bin/pip install -e ".[dev]"
cp .env.example .env
```

## Запуск сценариев одной командой

```bash
make scenarios
```

Команда применяет миграции, загружает seed (внутренние материалы KB и демо-принципалов, ключи печатаются
один раз) и проигрывает оба сценария на синтетических данных. Результаты: таблицы БД и каталог
`artifacts/<project_id>/`. Внешние действия остаются в очереди одобрений.

```bash
make demo
```

То же, но с имитацией решения человека; «отправка» пишет JSON в `outbox/`. Отдельно:
`hqteam scenarios run leads_to_offer` или `hqteam scenarios run autoparts`.

## API

```bash
make serve        # http://127.0.0.1:8000/docs
```

Все запросы — с заголовком `X-API-Key` (ключи из `hqteam db seed` или `hqteam principals add`).

| Метод | Путь | Кто |
|---|---|---|
| POST | /projects | OPERATOR / MANAGEMENT |
| POST | /projects/{id}/tasks | OPERATOR — маршрут DIRECT/PM/ESCALATION определяется автоматически |
| POST | /agents/{id}/run | OPERATOR — `{"task_id": ...}` или `{"until_idle": true}` |
| POST | /events | OPERATOR — событие агента; APPROVAL через этот путь создать нельзя |
| GET | /projects/{id}/status | статус, задачи, блокировки, одобрения, передачи |
| GET | /projects/{id}/artifacts | артефакты с версиями и checksum |
| GET | /approvals | очередь одобрений |
| POST | /approvals/{id}/decide | человек с требуемой ролью; `execute: true` — сразу исполнить |
| POST | /approvals/{id}/execute | человек; заголовок `Idempotency-Key` |
| POST | /kb/ingest | OPERATOR; `official` через API запрещён |
| GET | /audit?project_id= | журнал действий |
| POST | /scenarios/run | `{"name": "leads_to_offer" \| "autoparts" \| "all", "demo_approve": false}` |

## Переменные окружения (.env)

Полный список — в [.env.example](.env.example). Основные:

| Переменная | По умолчанию | Смысл |
|---|---|---|
| `HQ_DATABASE_URL` | `sqlite:///./hqteam.db` | для prod — PostgreSQL |
| `HQ_LLM_MODE` | `offline` | `live` — вызовы Anthropic API (нужен `ANTHROPIC_API_KEY`) |
| `HQ_LLM_MODEL` | `claude-opus-5-5` | модель агентов |
| `HQ_TASK_MAX_LLM_CALLS` / `HQ_TASK_MAX_COST_USD` | 8 / 2.0 | лимиты на задачу |
| `HQ_EXTERNAL_SEND_MODE` | `simulate` | внешние отправки только имитируются |
| `HQ_LEGAL_SOURCE_MAX_AGE_DAYS` | 90 | старше — NEEDS_VERIFICATION |

## Как добавить материал в базу знаний

```bash
hqteam kb ingest path/to/doc.md --role ARCH --source-url https://docs.vendor.example/page --source-kind user
hqteam kb search "vSphere HA" --role ARCH
```

Официальные тексты права и налогов загружаются только так:

1. Юрист указывает точный URL акта в `knowledge_base/legal/sources.json`.
2. `hqteam kb fetch-legal` загружает текст с хостов из allowlist и фиксирует дату проверки.
3. Ставки НДС подтверждает FIN-HUMAN в `knowledge_base/fin/tax_facts.json`.

Без этого LEGAL и FIN возвращают `NEEDS_VERIFICATION`.

## Как одобрить действие

```bash
hqteam approvals list
HQ_API_KEY=<ключ человека с нужной ролью> hqteam approvals decide <id> --approve --execute
```

Роли: `send_quote/send_email` — SALES_LEAD, `publish_content` — MARKETING_LEAD, `issue_contract` —
LEGAL_HUMAN, `issue_invoice` — FIN_HUMAN, `change_budget/commit_sla/commit_deadline/deliver_client_document`
— MANAGEMENT. Агент решения не принимает; ADMIN не одобряет за другие роли.

## Создание пользователей

```bash
hqteam principals add ivan --roles SALES_LEAD
```

Ключ выводится один раз; в БД хранится только SHA-256.

## Тесты и линтеры

```bash
make test         # 115 тестов: маршрутизация, state machine, RBAC, approval, idempotency, RAG, сценарии, API
make lint         # ruff + mypy
```

## Docker

```bash
echo "HQ_DB_PASSWORD=<пароль>" >> .env
docker compose up --build
```

Поднимает API и PostgreSQL. В среде разработки образ не собирался: не было Docker daemon (см. REPORT).
