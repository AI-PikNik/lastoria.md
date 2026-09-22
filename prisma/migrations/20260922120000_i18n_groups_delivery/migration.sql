-- Переход на 4 локали, управляемые группы товаров и иерархию доставки.
-- Миграция сохраняет данные: существующие (русские) тексты переезжают в
-- таблицы переводов с locale = 'ru', старые зоны доставки — в город «Кишинёв».

-- CreateEnum
CREATE TYPE "Locale" AS ENUM ('ro', 'ru', 'en', 'it');

-- CreateEnum
CREATE TYPE "CategoryKind" AS ENUM ('PIZZA', 'DRINK', 'ALCOHOL', 'OTHER', 'CUSTOM');

-- CreateTable
CREATE TABLE "category_translations" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "locale" "Locale" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "seoTitle" TEXT,
    "seoDescription" TEXT,

    CONSTRAINT "category_translations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_translations" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "locale" "Locale" NOT NULL,
    "name" TEXT NOT NULL,
    "shortDescription" TEXT,
    "description" TEXT,
    "ingredientsText" TEXT,
    "seoTitle" TEXT,
    "seoDescription" TEXT,
    "seoKeywords" TEXT,
    "shortAnswer" TEXT,
    "imageAlt" TEXT,

    CONSTRAINT "product_translations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery_cities" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "names" JSONB NOT NULL DEFAULT '{}',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "delivery_cities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery_zones" (
    "id" TEXT NOT NULL,
    "cityId" TEXT NOT NULL,
    "names" JSONB NOT NULL DEFAULT '{}',
    "fee" DECIMAL(10,2) NOT NULL,
    "freeFrom" DECIMAL(10,2),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "delivery_zones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ui_translations" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "locale" "Locale" NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ui_translations_pkey" PRIMARY KEY ("id")
);

-- New columns
ALTER TABLE "categories"
ADD COLUMN "imageUrl" TEXT,
ADD COLUMN "isSystem" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "kind" "CategoryKind" NOT NULL DEFAULT 'CUSTOM',
ADD COLUMN "requiresAgeConfirm" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "orders"
ADD COLUMN "ageConfirmed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "deliveryCityName" TEXT,
ADD COLUMN "deliveryZoneId" TEXT,
ADD COLUMN "deliveryZoneName" TEXT,
ADD COLUMN "locale" "Locale" NOT NULL DEFAULT 'ro';

ALTER TABLE "promos" ADD COLUMN "publicNames" JSONB NOT NULL DEFAULT '{}';

ALTER TABLE "settings"
ADD COLUMN "analyticsId" TEXT,
ADD COLUMN "cookieBannerEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "faviconUrl" TEXT,
ADD COLUMN "geoLat" DOUBLE PRECISION,
ADD COLUMN "geoLng" DOUBLE PRECISION,
ADD COLUMN "heroImageUrl" TEXT,
ADD COLUMN "logoUrl" TEXT,
ADD COLUMN "seoDescriptions" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN "seoTitles" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN "shortAnswers" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN "workingHoursI18n" JSONB NOT NULL DEFAULT '{}';

-- ============ Data migration ============

-- Тексты групп → переводы (ru)
INSERT INTO "category_translations" ("id", "categoryId", "locale", "name", "description", "seoTitle", "seoDescription")
SELECT gen_random_uuid()::text, "id", 'ru', "name", "description", "seoTitle", "seoDescription"
FROM "categories";

-- Тип группы — по преобладающему типу её товаров
UPDATE "categories" c
SET "kind" = sub."kind"::text::"CategoryKind"
FROM (
  SELECT DISTINCT ON ("categoryId") "categoryId", "type" AS "kind"
  FROM "products"
  GROUP BY "categoryId", "type"
  ORDER BY "categoryId", count(*) DESC
) sub
WHERE sub."categoryId" = c."id";

UPDATE "categories" SET "requiresAgeConfirm" = true WHERE "kind" = 'ALCOHOL';
UPDATE "categories" SET "isSystem" = true WHERE "slug" IN ('pizza', 'drinks', 'alcohol', 'snacks');

-- Тексты товаров → переводы (ru)
INSERT INTO "product_translations" ("id", "productId", "locale", "name", "shortDescription", "description", "ingredientsText", "seoTitle", "seoDescription", "seoKeywords")
SELECT
  gen_random_uuid()::text, "id", 'ru', "name", "shortDescription", "description",
  NULLIF(array_to_string(ARRAY(SELECT jsonb_array_elements_text(COALESCE("ingredients", '[]'::jsonb))), ', '), ''),
  "seoTitle", "seoDescription", "seoKeywords"
FROM "products";

-- Варианты: [{name, priceDelta}] → [{key, priceDelta, names:{ru}}]
UPDATE "products" p
SET "variants" = COALESCE((
  SELECT jsonb_agg(jsonb_build_object(
    'key', 'v' || v.ord,
    'priceDelta', COALESCE((v.elem->>'priceDelta')::numeric, 0),
    'names', jsonb_build_object('ru', v.elem->>'name')
  ) ORDER BY v.ord)
  FROM jsonb_array_elements(p."variants") WITH ORDINALITY AS v(elem, ord)
), '[]'::jsonb)
WHERE p."variants" IS NOT NULL AND jsonb_typeof(p."variants") = 'array';

UPDATE "products" SET "variants" = '[]'::jsonb WHERE "variants" IS NULL;

-- Промо: публичное имя
UPDATE "promos" SET "publicNames" = jsonb_build_object('ru', "name");

-- Настройки: SEO и часы работы
UPDATE "settings" SET
  "seoTitles" = jsonb_build_object('ru', "seoDefaultTitle"),
  "seoDescriptions" = jsonb_build_object('ru', "seoDefaultDescription"),
  "workingHoursI18n" = jsonb_build_object('ru', "workingHours");

-- Старые зоны доставки → город «Кишинёв»
INSERT INTO "delivery_cities" ("id", "slug", "names", "sortOrder", "isActive", "createdAt", "updatedAt")
SELECT 'city_chisinau', 'chisinau',
  '{"ro":"Chișinău","ru":"Кишинёв","en":"Chișinău","it":"Chișinău"}'::jsonb,
  0, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE EXISTS (
  SELECT 1 FROM "settings"
  WHERE jsonb_typeof("deliveryZones") = 'array' AND jsonb_array_length("deliveryZones") > 0
);

INSERT INTO "delivery_zones" ("id", "cityId", "names", "fee", "sortOrder", "isActive", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, 'city_chisinau',
  jsonb_build_object('ru', z.elem->>'name'),
  COALESCE((z.elem->>'fee')::numeric, 0),
  z.ord::int, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "settings" s,
  jsonb_array_elements(CASE WHEN jsonb_typeof(s."deliveryZones") = 'array' THEN s."deliveryZones" ELSE '[]'::jsonb END)
  WITH ORDINALITY AS z(elem, ord)
WHERE s."id" = 'main';

-- ============ Drop old structure ============

DROP INDEX "categories_isActive_idx";
DROP INDEX "orders_status_idx";
DROP INDEX "products_type_idx";

ALTER TABLE "categories"
DROP COLUMN "description",
DROP COLUMN "name",
DROP COLUMN "seoDescription",
DROP COLUMN "seoTitle";

ALTER TABLE "products"
DROP COLUMN "description",
DROP COLUMN "ingredients",
DROP COLUMN "name",
DROP COLUMN "seoDescription",
DROP COLUMN "seoKeywords",
DROP COLUMN "seoTitle",
DROP COLUMN "shortDescription",
DROP COLUMN "type",
ALTER COLUMN "variants" SET NOT NULL,
ALTER COLUMN "variants" SET DEFAULT '[]';

ALTER TABLE "settings"
DROP COLUMN "deliveryZones",
DROP COLUMN "seoDefaultDescription",
DROP COLUMN "seoDefaultTitle",
DROP COLUMN "workingHours";

ALTER TABLE "settings" RENAME COLUMN "workingHoursI18n" TO "workingHours";

DROP TYPE "ProductType";

-- CreateIndex
CREATE UNIQUE INDEX "category_translations_categoryId_locale_key" ON "category_translations"("categoryId", "locale");
CREATE UNIQUE INDEX "product_translations_productId_locale_key" ON "product_translations"("productId", "locale");
CREATE UNIQUE INDEX "delivery_cities_slug_key" ON "delivery_cities"("slug");
CREATE INDEX "delivery_zones_cityId_idx" ON "delivery_zones"("cityId");
CREATE UNIQUE INDEX "ui_translations_key_locale_key" ON "ui_translations"("key", "locale");
CREATE INDEX "categories_isActive_sortOrder_idx" ON "categories"("isActive", "sortOrder");
CREATE INDEX "categories_kind_idx" ON "categories"("kind");
CREATE INDEX "orders_status_createdAt_idx" ON "orders"("status", "createdAt");
CREATE INDEX "products_isFeatured_idx" ON "products"("isFeatured");

-- AddForeignKey
ALTER TABLE "category_translations" ADD CONSTRAINT "category_translations_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "product_translations" ADD CONSTRAINT "product_translations_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "delivery_zones" ADD CONSTRAINT "delivery_zones_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "delivery_cities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
