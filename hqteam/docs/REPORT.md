# Отчёт о реализации (2026-10-28)

## Приёмочные критерии

| # | Критерий | Статус | Где проверяется |
|---|---|---|---|
| 1 | 7 агентов с разными промптами, правами, инструментами | ✅ | `app/agents/*`, `prompts/*.md`, `core/security.py`; `tests/test_rbac.py` |
| 2 | API, БД, миграции, seed | ✅ | `app/api/main.py`, `db/migrations/versions/0001_initial_schema.py` (`alembic check` чистый), `db/seed.py` |
| 3 | Оба сценария одной командой, полный набор артефактов | ✅ | `make scenarios`; `tests/test_scenarios.py` |
| 4 | Видно, кто, кому и что передал; PM-маршрут и прямые передачи | ✅ | `agent_messages`, `/projects/{id}/status.handoffs`; `tests/test_routing.py` |
| 5 | Approval-гейты: без одобрения ничего внешнего | ✅ | `approvals/service.py`; `tests/test_approvals.py` |
| 6 | Право/налоги: источник и дата проверки, иначе NEEDS_VERIFICATION | ✅ | `knowledge/citations.py`, `tools/tax.py`; `tests/test_rag.py` |
| 7 | pytest: routing, state machine, RBAC, approval, idempotency, RAG-citation, сценарии 1 и 2 | ✅ 115 passed | `make test` |
| 8 | README | ✅ | `README.md` |
| 9 | Нет хардкода ключей, выдуманных законов и клиентов | ✅ | `tests/test_core.py::test_no_hardcoded_api_keys_in_repo`; клиенты помечены `[SYNTH]`, домены `.example` |

Проверено командами: `pytest` — 115 passed; `ruff check` — чисто; `mypy app db scenarios` — чисто;
`alembic check` — схема совпадает с моделями; SQL миграции рендерится для PostgreSQL; e2e через CLI на
файловой SQLite и живой uvicorn-сервер.

## Результат сценариев (offline, синтетика)

**Сценарий 1 «Лиды → КП»:** 7 задач, все DONE.
- MKT: 3 сегмента ICP со статусом HYPOTHESIS, без выдуманной статистики. CPL/CAC: `NO_DATA`.
- BDM: 4 лида принято, 1 отклонён (нет источника). Один лид — DO_NOT_CONTACT (отказ от коммуникаций),
  у одного consent UNKNOWN — по нему вопрос SALES_LEAD.
- Прямые передачи BDM→ARCH, BDM→FIN, BDM→LEGAL, PM получает NOTIFY.
- ARCH: гипотеза, допущения, риски, вопросы клиенту, раздел Security and Backup.
- FIN: разовые работы и ежемесячная поддержка отдельно, лицензии — NEEDS_VENDOR_QUOTE, НДС —
  NEEDS_VERIFICATION, total = null.
- LEGAL: драфты it_services, sla, nda; правовые основания — NEEDS_VERIFICATION, статус «не готов к
  подписанию».
- BDM собирает КП в DRAFT и запрашивает approval send_quote. Эскалация client_document → PM.
- PM: чек-лист полноты, реестр решений, список действий для людей.

**Сценарий 2 «AutoParts: сайт + CRM»:** 11 задач, все DONE.
- BDM: карточка клиента с согласием.
- PM: WBS, реестр рисков, SLA (approval commit_sla), ARCH назначен tech lead.
- ARCH: HLD/LLD с Mermaid, спецификацией ВМ, VLAN/IP, матрицей доступов, Security and Backup, DR,
  планами миграции и отката, разделом NOT_VERIFIED.
- LEGAL: договор подряда, DPA, SLA. FIN: смета по этапам, график платежей, черновик счёта на аванс
  (approval issue_invoice).
- PM: CPM — критический путь S1→S2→S3→S6 (approval commit_deadline).
- ARCH: заготовка стенда rev1. SUPPORT: прогон — 2 FAIL → ARCH bugfix rev2 → retest — 0 FAIL, 3
  NOT_VERIFIED.
- PM: акт приёмки (DRAFT, approval deliver_client_document), передача в поддержку.

## Что НЕ проверено и требует реальных доступов/документов

| Область | Что нужно | Кто |
|---|---|---|
| Тексты законов РМ (ГК, ТК, НК, ПДн, ЭП, IT-парки) | точные URL актов в `sources.json` и запуск `kb fetch-legal` (из среды разработки хосты legis.md/lex.justice.md недоступны) | юрист HQTeam |
| Закон о ПДн | подтвердить по официальному тексту: Закон №195/2024 действует с 23.08.2026 и заменил №133/2011 (пока подтверждено только вторичными источниками) | юрист |
| Ставки TVA, правила factura fiscală / e-Factura | загрузить НК РМ и акты SFS, подтвердить факты в `tax_facts.json` | бухгалтер (FIN-HUMAN) |
| Ставки HQTeam | реальный `rate_card.json` вместо демонстрационного | FIN-HUMAN |
| Цены лицензий VMware/Broadcom, бэкапа, NGFW | коммерческие предложения дистрибьюторов | FIN/ARCH |
| Шаблоны договоров HQTeam | реальные образцы — сейчас только шаблоны-структуры | юрист |
| Кейсы, прайс-лист, ICP HQTeam | реальные материалы и данные о продажах для CPL/CAC | MKT/BDM |
| Интеграция с учётной системой клиента | тип системы, API/формат обмена, тестовая база, учётные данные | клиент через BDM |
| Стенд: нагрузка, реальный restore, обмен остатками | развёрнутый стенд и профиль нагрузки | ARCH/SUPPORT |
| Docker-образ | сборка не проверялась: в среде нет Docker daemon | DevOps |
| Live-режим LLM | `ANTHROPIC_API_KEY`; путь `_live` не вызывался в тестах (нет сети и ключа) | оператор |
| Live-отправки (почта/CRM/e-Factura) | провайдеры не подключены намеренно; нужен выбор сервисов и решение MANAGEMENT | MANAGEMENT |

## Блокирующие вопросы (Этап 0)

Блокирующих неизвестных для реализации не осталось: всё недостающее закрыто defaults из ADR и явными
статусами NEEDS_VERIFICATION / NOT_VERIFIED / NEEDS_VENDOR_QUOTE. Для перевода в прод нужны только
материалы из таблицы выше.
