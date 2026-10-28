# Runbook оператора

## Ежедневно
1. `hqteam approvals list` — очередь одобрений. Решение принимает человек с ролью из колонки `role`.
2. `GET /projects/{id}/status` → `blocked` — задачи BLOCKED/ESCALATED и причины.
3. Открытые вопросы (`open_questions`) по адресатам: CLIENT → через BDM, LEGAL_HUMAN, FIN_HUMAN, MANAGEMENT.

## Одобрить действие
```bash
export HQ_API_KEY=<ключ человека с нужной ролью>
hqteam approvals decide <approval_id> --approve --comment "проверено" --execute
```
Отклонить: `--reject`. Через API: `POST /approvals/{id}/decide {"approve": true, "execute": true, "idempotency_key": "..."}`.

Если исполнение отказывает с «артефакт изменён после одобрения», значит после решения появилась новая
версия документа. Агент должен запросить новое одобрение: старое привязано к прежнему содержимому.

## Обновить правовые и налоговые источники (раз в ≤90 дней)
1. Юрист вносит точные URL актов в `knowledge_base/legal/sources.json` (поле `url`).
2. `hqteam kb fetch-legal` — загрузка с allowlist-хостов, фиксируется дата проверки.
3. FIN-HUMAN подтверждает ставки в `knowledge_base/fin/tax_facts.json` (rate, source_checksum,
   confirmed_by, confirmed_at).

## Эскалация «задача не движется»
`check_stale` эскалирует задачи старше `HQ_TASK_STALE_MINUTES`. Запускать по расписанию (cron/Celery beat):
```bash
hqteam check-stale
```

## Live-режим LLM
`HQ_LLM_MODE=live`, `ANTHROPIC_API_KEY` в окружении/secret manager. Расходы — таблица `llm_calls`; лимиты
задаются через `HQ_TASK_MAX_LLM_CALLS` и `HQ_TASK_MAX_COST_USD`.

## Live-отправки
Не подключены. Чтобы подключить почту, CRM или e-Factura, реализуйте провайдер в
`approvals/service.execute` для конкретного `action_type`, сохранив проверку статуса, hash и
idempotency_key. Перед этим нужно решение MANAGEMENT.
