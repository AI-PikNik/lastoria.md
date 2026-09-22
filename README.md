# La Storia — сайт пиццерии с админкой

Production-ready сайт пиццерии для рынка Молдовы: публичный каталог с корзиной и
оформлением заказа + закрытая админ-панель для управления каталогом, промо,
заказами и аналитикой.

## Стек

- **Next.js 16 (App Router)** + TypeScript (strict), Turbopack
- **Tailwind CSS v4** + собственный набор UI-компонентов в стиле shadcn/ui
  (`components/ui/*`, Radix UI примитивы + `class-variance-authority`)
- **Prisma 7 + PostgreSQL** (driver adapter `@prisma/adapter-pg`)
- **NextAuth v5 (Credentials)** — только для `/admin`
- **Zod** — валидация всех мутаций (server actions)
- **Recharts** — графики в админке
- **Resend** (или консоль в dev) — email; **Telegram Bot API** — уведомления
- **Vitest** — unit-тесты движка промо, статусов заказов и SEO-хелперов

## 1. Поднимаем PostgreSQL локально

Нужен любой доступный PostgreSQL 14+. Проще всего через Docker:

```bash
docker run --name lastoria-postgres \
  -e POSTGRES_USER=lastoria \
  -e POSTGRES_PASSWORD=lastoria \
  -e POSTGRES_DB=lastoria \
  -p 5432:5432 -d postgres:16
```

Либо локальный PostgreSQL (Ubuntu/Debian):

```bash
sudo service postgresql start
sudo -u postgres psql -c "CREATE USER lastoria WITH PASSWORD 'lastoria' CREATEDB;"
sudo -u postgres psql -c "CREATE DATABASE lastoria OWNER lastoria;"
```

## 2. Переменные окружения

Скопируйте `.env.example` в `.env` и заполните значения:

```bash
cp .env.example .env
```

| Переменная | Назначение |
| --- | --- |
| `DATABASE_URL` | строка подключения к PostgreSQL |
| `NEXT_PUBLIC_SITE_URL` | публичный URL сайта (metadata, sitemap, canonical, OG, а также allowedOrigins Server Actions за прокси) |
| `PORT` | порт, на котором слушает `next start` (по умолчанию 3000; на aaPanel — порт, который слушает PM2 и на который смотрит reverse proxy) |
| `AUTH_SECRET` | секрет NextAuth (`openssl rand -base64 32`) |
| `AUTH_URL` | URL приложения для NextAuth |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` / `ADMIN_NAME` | учётные данные администратора, создаваемого сид-скриптом |
| `EMAIL_PROVIDER` | `console` (пишет письма в консоль, по умолчанию для dev) или `resend` |
| `RESEND_API_KEY`, `EMAIL_FROM` | настройки Resend, если `EMAIL_PROVIDER=resend` |
| `ADMIN_NOTIFICATION_EMAIL` | адрес администратора для уведомлений о новых заказах |
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_ADMIN_CHAT_ID` | Telegram-бот для уведомлений (см. ниже) |
| `UPLOAD_PROVIDER` | `local` (по умолчанию, `/public/uploads`) или `s3` |
| `S3_*` | параметры S3-совместимого хранилища, если `UPLOAD_PROVIDER=s3` |
| `NEXT_PUBLIC_CURRENCY` | код валюты интерфейса (`MDL`) |

## 3. Установка зависимостей, миграции и сиды

```bash
pnpm install         # или npm install
pnpm db:migrate       # prisma migrate dev — создаёт схему в БД
pnpm db:seed          # заполняет БД демо-данными
pnpm dev              # http://localhost:3000
```

`pnpm db:seed` создаёт:
- администратора (`ADMIN_EMAIL` / `ADMIN_PASSWORD` из `.env`);
- 4 категории (Пицца, Напитки, Алкоголь, Снеки);
- 12 демо-товаров с SVG-заглушками фотографий (генерируются на лету, реального
  фотобанка нет — замените на настоящие фото через админку);
- 2 промо (скидка на товар и скидка на категорию);
- 6 демо-заказов в разных статусах и датах (текущий месяц и прошлые), чтобы
  аналитика и дашборд не были пустыми.

Скрипт идемпотентен: повторный запуск не создаёт дубликаты категорий/товаров/
администратора (заказы создаются один раз, если таблица заказов пуста).

> **Dev vs prod миграции.** `pnpm db:migrate` (`prisma migrate dev`) — для
> локальной разработки: может интерактивно создавать новые миграции и
> пересоздавать БД при конфликте схемы. На сервере (в т.ч. на aaPanel)
> используйте `pnpm db:deploy` (`prisma migrate deploy`) — он только
> накатывает уже существующие миграции из `prisma/migrations`, ничего не
> генерирует и не спрашивает подтверждений. См. раздел «Деплой на aaPanel».

## 4. Как создать ещё одного администратора

Через Prisma Studio (`pnpm db:studio`) добавьте запись в таблицу `users` с
`passwordHash`, сгенерированным через bcrypt, например:

```bash
node -e "require('bcryptjs').hash('новый-пароль', 10).then(console.log)"
```

и вставьте полученный хэш в поле `passwordHash` новой записи `User`
(`role: ADMIN`).

## 5. Подключение Telegram-бота

1. Создайте бота через [@BotFather](https://t.me/BotFather), получите токен и
   впишите его в `TELEGRAM_BOT_TOKEN`.
2. Напишите боту любое сообщение, затем откройте
   `https://api.telegram.org/bot<TOKEN>/getUpdates` и найдите `chat.id` —
   это `TELEGRAM_ADMIN_CHAT_ID` (либо укажите его в Настройках админки).
3. Без настроенных переменных уведомления в Telegram не отправляются —
   событие логируется и пишется `NotificationLog` со статусом `FAILED` и
   причиной `not configured` (это ожидаемое поведение, не баг).

## 6. Проверка sitemap и метаданных

```bash
curl http://localhost:3000/sitemap.xml
curl http://localhost:3000/robots.txt
curl http://localhost:3000/manifest.webmanifest
```

- `/sitemap.xml` должен содержать главную, статичные страницы, все активные
  категории (`/menu?category=...`) и все активные товары (`/menu/[slug]`).
- `/robots.txt` закрывает `/admin`, `/cart`, `/checkout`, `/order` от индексации.
- У каждой публичной страницы уникальные `<title>`, `<meta name="description">`,
  `<link rel="canonical">`, Open Graph/Twitter теги и JSON-LD
  (Organization, Restaurant, Menu, Product, BreadcrumbList — см. `lib/seo.ts`).
- В Настройках админки (`/admin/settings`) есть SEO-чеклист: список активных
  товаров без заполненных `seoTitle`/`seoDescription`.

## 7. Тесты

```bash
pnpm test
```

Покрыты unit-тестами:
- `lib/pricing.ts` — движок промо `calculateCartPricing` (процент на товар,
  скидка на категорию, конфликт нестекаемых промо, суммирование стекаемых,
  просроченное/будущее/выключенное промо игнорируется, ограничение по
  минимальной сумме заказа, `PRODUCT_OVERRIDE`, неотрицательный итог);
- `lib/constants.ts` — жизненный цикл статусов заказа (`NEXT_ORDER_STATUS`,
  `CONFIRMED_STATUSES`);
- `lib/seo.ts`, `lib/slug.ts` — построение метаданных, canonical, JSON-LD и
  транслитерация ЧПУ.

## 8. Загрузка файлов

По умолчанию (`UPLOAD_PROVIDER=local`) изображения сохраняются в
`/public/uploads` и раздаются напрямую Next.js. Для продакшена можно
переключиться на S3-совместимое хранилище (AWS S3, MinIO, DigitalOcean
Spaces и т.п.), указав `UPLOAD_PROVIDER=s3` и заполнив `S3_*` — интерфейс
`StorageAdapter` (`lib/uploads/types.ts`) одинаков для обеих реализаций, само
приложение не знает, где физически лежат файлы.

## 9. Rate-limiting оформления заказа

`lib/rate-limit.ts` — простой in-memory rate-limit (5 заказов за 10 минут на
IP) в рамках **одного инстанса** приложения. Он не переживает рестарт
процесса и не работает согласованно при нескольких инстансах/подах —
для горизонтального масштабирования нужен внешний стор (Redis и т.п.).

## 10. Деплой на aaPanel

Пошаговый запуск проекта на сервере с [aaPanel](https://www.aapanel.com/)
(веб-панель управления Linux-сервером). Ниже — сценарий «всё в одной
панели»: PostgreSQL в Docker-контейнере (доступен на любой сборке aaPanel) +
Node.js-приложение под PM2 + Nginx как обратный прокси с SSL.

Понадобится: сервер с установленной aaPanel (Ubuntu 20.04+/22.04,
Debian или CentOS), домен, указывающий A-записью на сервер, root/sudo-доступ.

### 10.1. Плагины aaPanel

В **App Store** (Магазин приложений) aaPanel установите:

1. **Nginx** — обычно ставится при первичной настройке панели, если ещё нет — установите.
2. **Docker Manager** (Docker-менеджер) — понадобится для PostgreSQL.
3. **PM2 Manager** (может называться «Node.js 版本管理器» / «Node.js Version Manager» /
   «PM2 管理器» в зависимости от локализации) — управление Node.js-процессами через PM2.

> Если в вашей сборке aaPanel есть отдельный плагин **PostgreSQL Manager**
> (Databases → PostgreSQL) — можно использовать его вместо Docker-контейнера
> из шага 10.2, тогда просто создайте через него пользователя `lastoria` и
> базу `lastoria` и переходите к 10.3.

### 10.2. PostgreSQL через Docker Manager

1. Откройте **Docker Manager → Images**, найдите и скачайте (Pull) образ `postgres:16`.
2. **Docker Manager → Containers → Create container**:
   - Image: `postgres:16`
   - Container name: `lastoria-postgres`
   - Port mapping: `5432 → 5432` (host → container; если 5432 на хосте занят, используйте другой, например `15432 → 5432`, и не забудьте поменять порт в `DATABASE_URL` на следующем шаге)
   - Environment variables:
     - `POSTGRES_USER=lastoria`
     - `POSTGRES_PASSWORD=<сложный пароль>`
     - `POSTGRES_DB=lastoria`
   - Volume: хостовый путь `/www/dockerdata/lastoria-pgdata` → контейнерный `/var/lib/postgresql/data` (без volume данные пропадут при пересоздании контейнера)
   - Restart policy: `always`
3. Запустите контейнер. Итоговая строка подключения:
   `postgresql://lastoria:<пароль>@127.0.0.1:5432/lastoria?schema=public`

### 10.3. Node.js и код проекта

1. **PM2 Manager → Node.js Version Manager** — установите Node.js **22.x**
   (та же мажорная версия, на которой собирался проект).
2. Откройте встроенный **Terminal** aaPanel (пункт в левом меню) и установите pnpm — проект использует `pnpm-lock.yaml`:
   ```bash
   npm install -g pnpm
   ```
3. Склонируйте проект в `/www/wwwroot`:
   ```bash
   cd /www/wwwroot
   git clone <URL-вашего-репозитория> lastoria.md
   cd lastoria.md
   ```
   (Либо загрузите архив проекта через **File Manager → Upload** и распакуйте там же, если Git недоступен.)

### 10.4. Переменные окружения

Через терминал:

```bash
cd /www/wwwroot/lastoria.md
cp .env.example .env
openssl rand -base64 32   # скопируйте вывод для AUTH_SECRET
```

Откройте `.env` в **File Manager** (двойной клик → редактор) и заполните минимум:

- `DATABASE_URL` — строка из шага 10.2
- `NEXT_PUBLIC_SITE_URL=https://ваш-домен`
- `AUTH_URL=https://ваш-домен`
- `AUTH_SECRET` — значение из `openssl rand -base64 32`
- `PORT=3000` (или другой свободный порт — тот же укажете в PM2 и в reverse proxy)
- `ADMIN_EMAIL` / `ADMIN_PASSWORD` — учётные данные администратора
- при необходимости — `TELEGRAM_BOT_TOKEN`/`TELEGRAM_ADMIN_CHAT_ID`, `EMAIL_PROVIDER=resend`/`RESEND_API_KEY`/`EMAIL_FROM`, `UPLOAD_PROVIDER=s3`/`S3_*`

### 10.5. Установка, миграции, сборка

Через терминал aaPanel:

```bash
cd /www/wwwroot/lastoria.md
pnpm install
pnpm db:deploy     # prisma migrate deploy — применяет готовые миграции, безопасно для прод
pnpm db:seed       # опционально: демо-каталог, если хотите начать не с пустого сайта
pnpm build
```

Права на папку загрузок (замените `www` на пользователя, от имени которого
работает PM2 в вашей aaPanel — по умолчанию это системный пользователь `www`):

```bash
chown -R www:www /www/wwwroot/lastoria.md/public/uploads
```

### 10.6. Запуск через PM2 Manager

В интерфейсе **PM2 Manager** добавьте новый проект:

- **Каталог проекта / Project path**: `/www/wwwroot/lastoria.md`
- **Имя проекта**: `lastoria`
- **Способ запуска / Startup mode**: `npm` (если такого пункта нет — выберите
  «Custom»/«Произвольная команда» и укажите `pnpm start`, либо пропишите
  напрямую `node_modules/.bin/next start -p 3000`)
- **Команда / Run command**: `start` (то есть выполняется `npm run start`,
  который в `package.json` уже настроен как `next start -p ${PORT:-3000}`)
- **Порт**: тот же, что указан в `.env` как `PORT` (по умолчанию 3000)
- **Режим/instances**: `fork`, 1 инстанс

> **Почему 1 инстанс (fork), а не cluster с несколькими воркерами.**
> Приложение активно использует Next.js Server Actions (все формы в
> админке и оформление заказа). При запуске нескольких инстансов Node в
> режиме `cluster` каждый воркер по умолчанию генерирует свой ключ
> шифрования для Server Actions, и запросы, обработанные одним воркером,
> будут падать с ошибкой «Failed to find Server Action» на другом. Одного
> `fork`-инстанса с лихвой хватает для сайта пиццерии; если позже
> понадобится `cluster`-режим — задайте одинаковый
> `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` (32-байтный base64-ключ) для всех
> инстансов через переменные окружения PM2 и пересоберите проект.

Сохраните и запустите проект. В логах PM2 Manager должна появиться строка
`✓ Ready` без ошибок подключения к БД.

### 10.7. Сайт и обратный прокси (Nginx)

1. **Website → Add site**: укажите домен, тип — без PHP (Pure/Static или «не
   создавать конфигурацию PHP», так как за сайтом стоит Node-приложение, а
   не PHP).
2. Откройте настройки созданного сайта → **反向代理 / Reverse Proxy → Add
   reverse proxy**:
   - Target URL (目标URL): `http://127.0.0.1:3000` (порт из шага 10.6)
   - Send domain (发送域名): `$host`
3. Откройте для этого reverse proxy файл конфигурации (**配置文件 / Config
   file**) и убедитесь, что проставлены следующие заголовки (aaPanel обычно
   добавляет часть из них автоматически при создании прокси — донастройте
   недостающее вручную):
   ```nginx
   proxy_set_header Host $host;
   proxy_set_header X-Real-IP $remote_addr;
   proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
   proxy_set_header X-Forwarded-Proto $scheme;
   proxy_set_header X-Forwarded-Host $host;
   proxy_http_version 1.1;
   proxy_set_header Upgrade $http_upgrade;
   proxy_set_header Connection "upgrade";
   proxy_buffering off;
   ```
   Заголовок `X-Forwarded-Host` важен: по нему Next.js сверяет источник
   запроса для Server Actions (см. `next.config.ts` → `experimental.
   serverActions.allowedOrigins`, куда автоматически подставляется домен из
   `NEXT_PUBLIC_SITE_URL` — это подстраховка на случай, если прокси его не
   передаёт). `proxy_buffering off` нужен, чтобы корректно работал
   стриминг ответов App Router (Suspense/`loading.tsx`).
4. **SSL** → выпустите сертификат **Let's Encrypt** для домена и включите
   принудительный редирект на HTTPS.

### 10.8. Проверка

- `https://ваш-домен/` — открывается главная страница.
- `https://ваш-домен/admin/login` — вход под `ADMIN_EMAIL` / `ADMIN_PASSWORD`.
- `https://ваш-домен/sitemap.xml`, `/robots.txt`, `/manifest.webmanifest` —
  отдаются корректно (см. раздел 6).
- Оформите тестовый заказ на сайте → убедитесь, что он появился в
  `/admin/orders` со статусом «Ожидает подтверждения», и что при его
  подтверждении в PM2-логах не возникает ошибок (Telegram/Email из коробки
  работают только при заполненных `TELEGRAM_*`/`RESEND_*` в `.env`).

### 10.9. Обновление проекта

```bash
cd /www/wwwroot/lastoria.md
git pull
pnpm install
pnpm db:deploy
pnpm build
```

После этого нажмите **Restart** для проекта в PM2 Manager.

## 11. Структура проекта

```
app/
  (public)/        публичный сайт: главная, /menu, /cart, /checkout, /order/[id], статика
  admin/            закрытая админка (см. app/admin/layout.tsx — noindex)
    (dashboard)/    страницы после авторизации: заказы, товары, категории, промо, аналитика…
    login/          страница входа
  api/auth/         NextAuth route handler
  sitemap.ts, robots.ts, manifest.ts, icon.tsx, apple-icon.tsx
lib/
  pricing.ts        движок расчёта цены корзины с промо (без побочных эффектов, покрыт тестами)
  pricing-data.ts   обвязка над pricing.ts для каталога (загрузка промо из БД)
  notifications.ts  Telegram/Email уведомления + запись NotificationLog
  uploads/          адаптер хранилища файлов (local / s3)
  seo.ts            построение Metadata API и JSON-LD
  actions/          server actions (checkout, orders, products, categories, promos, settings, media, auth)
  validation.ts     Zod-схемы всех форм и мутаций
prisma/
  schema.prisma     доменная модель
  seed.ts           демо-данные
components/
  ui/               базовые компоненты (в духе shadcn/ui)
  public/, admin/   компоненты публичного сайта и админки
tests/              vitest unit-тесты
```

## Сознательно вне скоупа v1

- онлайн-оплата картой (в v1 — наличными или картой курьеру);
- мультиязычный интерфейс (весь UI на русском, `hreflang` не добавлен);
- живая карта курьера;
- личные кабинеты клиентов (клиент видит статус заказа по публичной ссылке
  `/order/[token]` без авторизации);
- полноценный складской учёт (только простое поле `stock` у товара);
- маркетплейс/несколько ресторанов;
- нативные мобильные приложения.

## Известные допущения

- Изображения товаров в сид-данных — сгенерированные SVG-заглушки
  (`prisma/seed-placeholders.ts`), а не реальные фотографии; замените их через
  редактор товара в админке.
- Верхнеуровневый язык интерфейса, вопреки списку локалей в ТЗ (ro/ru/it/en),
  реализован только на русском — по явному пункту ТЗ «весь пользовательский
  текст на русском» и отсутствию требования добавлять `hreflang`. Остальные
  локали — предмет будущей итерации.
