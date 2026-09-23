#!/usr/bin/env bash
#
# Первая настройка или обновление сайта на сервере с aaPanel — одной командой:
#
#   bash /www/wwwroot/lastoria/scripts/aapanel-update.sh
#
# Что делает по шагам:
#   1. находит npm, установленный плагином «Node.js Version Manager»;
#   2. ставит библиотеки (npm install);
#   3. генерирует клиент базы данных под текущую версию кода (prisma generate);
#   4. обновляет структуру базы (prisma migrate deploy) — данные сохраняются;
#   5. заполняет демо-данные и недостающие переводы (seed; пропустить: --no-seed);
#   6. собирает сайт (next build);
#   7. отдаёт все файлы проекта пользователю www, от имени которого aaPanel
#      запускает Node-проект, и выставляет права 755/644 (иначе сайт не может
#      прочитать свои файлы или сохранить загруженные фото).
#
# После скрипта нажмите Restart в карточке Node-проекта.
#
# Параметры:
#   --no-seed     не запускать заполнение демо-данными
#   RUN_USER=...  другой пользователь запуска (по умолчанию www)

set -euo pipefail

RUN_SEED=1
for arg in "$@"; do
  case "$arg" in
    --no-seed) RUN_SEED=0 ;;
    *) echo "Неизвестный параметр: $arg"; exit 1 ;;
  esac
done

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUN_USER="${RUN_USER:-www}"
cd "$PROJECT_DIR"

step() { printf '\n\033[1;33m==> %s\033[0m\n' "$1"; }
fail() { printf '\n\033[1;31mОШИБКА: %s\033[0m\n' "$1"; exit 1; }

step "Папка проекта: $PROJECT_DIR"

# 1. npm от Node.js Version Manager лежит не в общем PATH — ищем сами
if ! command -v npm >/dev/null 2>&1; then
  NODE_BIN="$(ls -d /www/server/nodejs/v*/bin 2>/dev/null | sort -V | tail -n 1 || true)"
  [ -n "$NODE_BIN" ] && export PATH="$NODE_BIN:$PATH"
fi
command -v npm >/dev/null 2>&1 || fail "не найден npm. Установите Node.js 22 в aaPanel: App Store → Node.js Version Manager."
echo "Node.js $(node -v), npm $(npm -v)"

[ -f .env ] || fail "нет файла .env — создайте его из .env.example (README, шаг 4)."
[ -f package.json ] || fail "в папке нет package.json — проверьте путь к проекту."

step "1/6 Установка библиотек (npm install)"
npm install --no-audit --no-fund

step "2/6 Клиент базы данных (prisma generate)"
npx prisma generate

step "3/6 Структура базы данных (prisma migrate deploy)"
npx prisma migrate deploy

if [ "$RUN_SEED" = "1" ]; then
  step "4/6 Демо-данные и недостающие переводы (seed)"
  npx tsx prisma/seed.ts
else
  step "4/6 Seed пропущен (--no-seed)"
fi

step "5/6 Сборка сайта (next build) — занимает 1–3 минуты"
npx next build

step "6/6 Права доступа для пользователя $RUN_USER"
mkdir -p public/uploads
if id "$RUN_USER" >/dev/null 2>&1; then
  chown -R "$RUN_USER":"$RUN_USER" "$PROJECT_DIR"
  # папки 755, файлы 644, исполняемые файлы остаются исполняемыми
  chmod -R u+rwX,go+rX,go-w "$PROJECT_DIR"
  # файл с паролями — только владельцу
  chmod 600 "$PROJECT_DIR/.env"
  echo "Владелец файлов: $RUN_USER, права: папки 755, файлы 644, .env 600"
else
  echo "Пользователь $RUN_USER не найден — права не менялись."
fi

printf '\n\033[1;32mГотово!\033[0m Теперь в aaPanel: Website → Node project → ваш проект → Restart.\n'
