# Чек-листы диагностики L1/L2 (только неразрушающие команды)

## Сеть (по модели OSI снизу вверх)
1. Физика/канал: линк, ошибки на порту (только просмотр).
2. IP: `ip a` / `ipconfig /all`, шлюз, маска.
3. Доступность: `ping <gateway>`, `ping <target>`.
4. Маршрут: `traceroute` / `tracert`.
5. DNS: `nslookup <name>`, `dig <name>`.

## Linux
`systemctl status <svc>`, `journalctl -u <svc> --since "1 hour ago"`, `df -h`, `free -m`.

## Windows Server
Event Viewer (System/Application), `Get-Service`, `Test-NetConnection`.

## VMware
Состояние хостов/ВМ в vCenter, alarms, datastore usage — только чтение.

## Бэкапы
Статус последнего задания, дата последнего успешного теста восстановления.

Правило записи: «проверено» / «предполагается» / «нужен доступ».
