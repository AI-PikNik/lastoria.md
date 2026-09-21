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
| `NEXT_PUBLIC_SITE_URL` | публичный URL сайта (используется в metadata, sitemap, canonical, OG) |
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

## 10. Структура проекта

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
