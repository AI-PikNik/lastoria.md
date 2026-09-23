#!/usr/bin/env bash
#
# Первая настройка или обновление сайта на сервере с aaPanel — одной командой:
#
#   bash /www/wwwroot/lastoria/scripts/aapanel-update.sh
#
# Что делает по шагам:
#   0. чинит права на файлы проекта (после распаковки архива, git pull или
#      смены прав в File Manager файлы часто становятся «только для root»,
#      а у утилит в node_modules пропадает право на запуск);
#   1. ставит библиотеки строго по package-lock.json (npm ci);
#   2. генерирует клиент базы данных под текущую версию кода (prisma generate);
#   3. обновляет структуру базы (prisma migrate deploy) — данные сохраняются;
#   4. заполняет демо-данные и недостающие переводы (seed; пропустить: --no-seed);
#   5. собирает сайт (next build);
#   6. отдаёт все файлы пользователю www, от имени которого aaPanel запускает
#      Node-проект: папки 755, файлы 644, .env 600.
#
# После скрипта нажмите Restart в карточке Node-проекта.
#
# Параметры:
#   --no-seed     не запускать заполнение демо-данными
#   RUN_USER=...  другой пользователь запуска (по умолчанию www)

set -euo pipefail

# Новые файлы — читаемы для всех (на многих VPS у root umask 077, и тогда
# всё, что создаёт npm или сборка, недоступно пользователю www)
umask 022

RUN_SEED=1
for arg in "$@"; do
  case "$arg" in
    --no-seed) RUN_SEED=0 ;;
    *) echo "Неизвестный параметр: $arg"; exit 1 ;;
  esac
done

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUN_USER="${RUN_USER:-www}"
IS_ROOT=0
[ "$(id -u)" = "0" ] && IS_ROOT=1
cd "$PROJECT_DIR"

step() { printf '\n\033[1;33m==> %s\033[0m\n' "$1"; }
fail() { printf '\n\033[1;31mОШИБКА: %s\033[0m\n' "$1"; exit 1; }

# Права: папки и файлы читаемы, исполняемые остаются исполняемыми, .env закрыт
normalize_permissions() {
  chmod -R u+rwX,go+rX,go-w "$PROJECT_DIR" 2>/dev/null || true
  [ -f "$PROJECT_DIR/.env" ] && chmod 600 "$PROJECT_DIR/.env"
  # Утилиты из node_modules/.bin (prisma, next, tsx…) должны запускаться,
  # даже если право на запуск потерялось при копировании/смене прав
  if [ -d "$PROJECT_DIR/node_modules" ]; then
    find "$PROJECT_DIR/node_modules" -path '*/.bin/*' -exec chmod a+rx {} + 2>/dev/null || true
  fi
}

step "Папка проекта: $PROJECT_DIR"

# npm от Node.js Version Manager лежит не в общем PATH — ищем сами
if ! command -v npm >/dev/null 2>&1; then
  NODE_BIN="$(ls -d /www/server/nodejs/v22*/bin 2>/dev/null | sort -V | tail -n 1 || true)"
  [ -z "$NODE_BIN" ] && NODE_BIN="$(ls -d /www/server/nodejs/v*/bin 2>/dev/null | sort -V | tail -n 1 || true)"
  [ -n "$NODE_BIN" ] && export PATH="$NODE_BIN:$PATH"
fi
command -v npm >/dev/null 2>&1 || fail "не найден npm. Установите Node.js 22 в aaPanel: App Store → Node.js Version Manager."
echo "Node.js $(node -v) ($(command -v node)), npm $(npm -v 2>/dev/null) ($(command -v npm))"

[ -f .env ] || fail "нет файла .env — создайте его из .env.example (README, шаг 4)."
[ -f package.json ] || fail "в папке нет package.json — проверьте путь к проекту."

# Если проект обновляется через git: после смены владельца на www git от root
# отказывается работать («dubious ownership») — помечаем папку как доверенную
if [ -d .git ] && command -v git >/dev/null 2>&1; then
  if ! git config --global --get-all safe.directory 2>/dev/null | grep -qxF "$PROJECT_DIR"; then
    git config --global --add safe.directory "$PROJECT_DIR" || true
  fi
fi

step "0/6 Права на файлы проекта"
normalize_permissions
echo "Готово: папки 755, файлы 644, утилиты node_modules/.bin исполняемые"

step "1/6 Установка библиотек"
# npm ci ставит строго по package-lock.json и не меняет его — иначе следующий
# «git pull» остановится из-за локальных изменений в package-lock.json
if [ -f package-lock.json ]; then
  npm ci --no-audit --no-fund
else
  npm install --no-audit --no-fund
fi
normalize_permissions

# Утилиты запускаем через node — так им не нужно право на запуск файла
PRISMA="node node_modules/prisma/build/index.js"
NEXT="node node_modules/next/dist/bin/next"
TSX="node node_modules/tsx/dist/cli.mjs"

step "2/6 Клиент базы данных (prisma generate)"
$PRISMA generate

step "3/6 Структура базы данных (prisma migrate deploy)"
$PRISMA migrate deploy

if [ "$RUN_SEED" = "1" ]; then
  step "4/6 Демо-данные и недостающие переводы (seed)"
  $TSX prisma/seed.ts
else
  step "4/6 Seed пропущен (--no-seed)"
fi

step "5/6 Сборка сайта (next build) — занимает 1–3 минуты"
$NEXT build

step "6/6 Владелец файлов и права для пользователя $RUN_USER"
mkdir -p public/uploads
normalize_permissions
if [ "$IS_ROOT" = "1" ] && id "$RUN_USER" >/dev/null 2>&1; then
  chown -R "$RUN_USER":"$RUN_USER" "$PROJECT_DIR"
  echo "Владелец файлов: $RUN_USER; папки 755, файлы 644, .env 600"
elif [ "$IS_ROOT" = "0" ]; then
  echo "Скрипт запущен не от root — владельца файлов поменять нельзя (это нормально, если сайт работает от вашего пользователя)."
else
  echo "Пользователь $RUN_USER не найден — владелец не менялся."
fi

printf '\n\033[1;32mГотово!\033[0m Теперь в aaPanel: Website → Node project → ваш проект → Restart.\n'
