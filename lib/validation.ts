import { z } from "zod";
import { LOCALES } from "@/lib/i18n/locales";
import { isValidMoldovanPhone, normalizeMoldovanPhone } from "@/lib/phone";

export const localeSchema = z.enum(LOCALES);
export const categoryKindSchema = z.enum(["PIZZA", "DRINK", "ALCOHOL", "OTHER", "CUSTOM"]);
export const promoTypeSchema = z.enum(["PERCENT", "FIXED", "PRODUCT_OVERRIDE"]);
export const promoScopeSchema = z.enum(["PRODUCT", "CATEGORY", "PRODUCT_TYPE", "CART"]);
export const fulfillmentSchema = z.enum(["DELIVERY", "PICKUP"]);
export const paymentMethodSchema = z.enum(["CASH", "CARD_ON_DELIVERY"]);
export const orderStatusSchema = z.enum([
  "PENDING_CONFIRMATION",
  "CONFIRMED",
  "PREPARING",
  "OUT_FOR_DELIVERY",
  "READY_FOR_PICKUP",
  "COMPLETED",
  "CANCELLED",
]);

const slugSchema = z
  .string()
  .trim()
  .min(2, "Slug должен быть не короче 2 символов")
  .max(120)
  .regex(/^[a-z0-9-]+$/, "Slug: только латиница в нижнем регистре, цифры и дефис");

const text = (max: number) => z.string().trim().max(max).optional().default("");

/** Карта значений на 4 языках: { ro, ru, en, it } */
export const localizedTextSchema = (max = 300) =>
  z.object({ ro: text(max), ru: text(max), en: text(max), it: text(max) });

function hasAnyValue(map: Record<string, string | undefined>) {
  return Object.values(map).some((v) => (v ?? "").trim().length > 0);
}

/* ─────────────── Товары ─────────────── */

export const productTranslationSchema = z.object({
  name: text(200),
  shortDescription: text(500),
  description: text(20000),
  ingredientsText: text(2000),
  seoTitle: text(200),
  seoDescription: text(500),
  seoKeywords: text(300),
  shortAnswer: text(1500),
  imageAlt: text(300),
});

export type ProductTranslationInput = z.infer<typeof productTranslationSchema>;

const variantSchema = z.object({
  key: z
    .string()
    .trim()
    .min(1)
    .max(40)
    .regex(/^[a-z0-9-]+$/, "Ключ варианта: латиница, цифры, дефис"),
  priceDelta: z.coerce.number().min(-100000).max(100000),
  names: localizedTextSchema(100),
});

export const productSchema = z
  .object({
    slug: slugSchema,
    categoryId: z.string().min(1, "Выберите группу"),
    price: z.coerce.number().positive("Цена должна быть больше нуля"),
    oldPrice: z.coerce.number().positive().nullable().optional(),
    isAlcohol: z.boolean().default(false),
    isVegetarian: z.boolean().default(false),
    isSpicy: z.boolean().default(false),
    isActive: z.boolean().default(true),
    isFeatured: z.boolean().default(false),
    sku: text(100),
    sortOrder: z.coerce.number().int().default(0),
    stock: z.coerce.number().int().nullable().optional(),
    /** Фото по порядку: первое — главное */
    images: z.array(z.string().max(500)).max(20).default([]),
    ogImageUrl: z.string().max(500).nullable().optional(),
    variants: z.array(variantSchema).max(20).default([]),
    translations: z.object({
      ro: productTranslationSchema,
      ru: productTranslationSchema,
      en: productTranslationSchema,
      it: productTranslationSchema,
    }),
  })
  .refine((d) => LOCALES.some((l) => d.translations[l].name.length >= 2), {
    message: "Укажите название хотя бы на одном языке (лучше — на румынском)",
    path: ["translations"],
  })
  .refine((d) => new Set(d.variants.map((v) => v.key)).size === d.variants.length, {
    message: "Ключи вариантов должны быть уникальными",
    path: ["variants"],
  });

export type ProductInput = z.infer<typeof productSchema>;

/* ─────────────── Группы ─────────────── */

export const categoryTranslationSchema = z.object({
  name: text(200),
  description: text(2000),
  seoTitle: text(200),
  seoDescription: text(500),
});

export const categorySchema = z
  .object({
    slug: slugSchema,
    kind: categoryKindSchema.default("CUSTOM"),
    requiresAgeConfirm: z.boolean().default(false),
    isActive: z.boolean().default(true),
    imageUrl: z.string().max(500).nullable().optional(),
    translations: z.object({
      ro: categoryTranslationSchema,
      ru: categoryTranslationSchema,
      en: categoryTranslationSchema,
      it: categoryTranslationSchema,
    }),
  })
  .refine((d) => LOCALES.some((l) => d.translations[l].name.length >= 2), {
    message: "Укажите название группы хотя бы на одном языке",
    path: ["translations"],
  });

export type CategoryInput = z.infer<typeof categorySchema>;

/* ─────────────── Промо ─────────────── */

export const promoSchema = z
  .object({
    name: z.string().trim().min(2, "Внутреннее название — минимум 2 символа").max(200),
    publicNames: localizedTextSchema(200),
    code: z
      .string()
      .trim()
      .max(50)
      .regex(/^[A-Za-z0-9_-]*$/, "Промокод: латиница, цифры, дефис и подчёркивание")
      .optional()
      .default(""),
    type: promoTypeSchema,
    value: z.coerce.number().positive("Значение должно быть больше нуля"),
    scope: promoScopeSchema,
    targetIds: z.array(z.string()).default([]),
    minOrderAmount: z.coerce.number().positive().nullable().optional(),
    startsAt: z.coerce.date(),
    endsAt: z.coerce.date(),
    isActive: z.boolean().default(true),
    stackable: z.boolean().default(false),
  })
  .refine((data) => data.endsAt > data.startsAt, {
    message: "Дата окончания должна быть позже даты начала",
    path: ["endsAt"],
  })
  .refine((data) => data.scope === "CART" || data.targetIds.length > 0, {
    message: "Укажите хотя бы одну цель промо",
    path: ["targetIds"],
  })
  .refine((data) => data.type !== "PERCENT" || data.value <= 100, {
    message: "Процент скидки не может быть больше 100",
    path: ["value"],
  });

export type PromoInput = z.infer<typeof promoSchema>;

/* ─────────────── Доставка ─────────────── */

export const deliveryCitySchema = z
  .object({
    slug: slugSchema,
    names: localizedTextSchema(120),
    isActive: z.boolean().default(true),
  })
  .refine((d) => hasAnyValue(d.names), { message: "Укажите название города", path: ["names"] });

export const deliveryZoneSchema = z
  .object({
    cityId: z.string().min(1),
    names: localizedTextSchema(120),
    fee: z.coerce.number().min(0, "Стоимость не может быть отрицательной"),
    freeFrom: z.coerce.number().positive().nullable().optional(),
    isActive: z.boolean().default(true),
  })
  .refine((d) => hasAnyValue(d.names), { message: "Укажите название района", path: ["names"] });

/* ─────────────── Настройки ─────────────── */

export const settingsSchema = z.object({
  restaurantName: z.string().trim().min(1, "Укажите название").max(120),
  restaurantPhone: z.string().trim().min(5, "Укажите телефон").max(40),
  restaurantAddress: z.string().trim().min(1, "Укажите адрес").max(300),
  restaurantEmail: z.string().trim().email("Неверный email").optional().or(z.literal("")),
  workingHours: localizedTextSchema(200),
  minOrderAmount: z.coerce.number().min(0),
  seoTitles: localizedTextSchema(200),
  seoDescriptions: localizedTextSchema(500),
  shortAnswers: localizedTextSchema(1500),
  telegramChatId: z.string().trim().max(100).optional().or(z.literal("")),
  emailSenderAddress: z.string().trim().email("Неверный email").optional().or(z.literal("")),
  logoUrl: z.string().max(500).nullable().optional(),
  faviconUrl: z.string().max(500).nullable().optional(),
  heroImageUrl: z.string().max(500).nullable().optional(),
  geoLat: z.coerce.number().min(-90).max(90).nullable().optional(),
  geoLng: z.coerce.number().min(-180).max(180).nullable().optional(),
  cookieBannerEnabled: z.boolean().default(true),
  analyticsId: z
    .string()
    .trim()
    .max(40)
    .regex(/^(G-[A-Z0-9]+)?$/, "ID Google Analytics вида G-XXXXXXX")
    .optional()
    .or(z.literal("")),
});

export type SettingsInput = z.infer<typeof settingsSchema>;

/* ─────────────── Оформление заказа (публичная часть) ─────────────── */
// Сообщения об ошибках — ключи словаря messages/*.json, их переводит клиент.

const cartItemSchema = z.object({
  productId: z.string().min(1),
  variantKey: z.string().max(40).optional().nullable(),
  qty: z.coerce.number().int().positive().max(50),
});

export const checkoutSchema = z
  .object({
    locale: localeSchema.default("ro"),
    customerName: z.string().trim().min(2, "validation.nameRequired").max(200),
    phone: z
      .string()
      .trim()
      .refine(isValidMoldovanPhone, "validation.phoneInvalid")
      .transform((value) => normalizeMoldovanPhone(value)!),
    email: z.string().trim().email("validation.emailInvalid").optional().or(z.literal("")),
    fulfillment: fulfillmentSchema,
    zoneId: z.string().max(100).optional().or(z.literal("")),
    address: z.string().trim().max(500).optional().or(z.literal("")),
    comment: z.string().trim().max(1000).optional().or(z.literal("")),
    paymentMethod: paymentMethodSchema.default("CASH"),
    ageConfirmed: z.boolean().optional().default(false),
    promoCode: z.string().trim().max(50).optional().or(z.literal("")),
    items: z.array(cartItemSchema).min(1, "validation.cartEmpty").max(50),
  })
  .refine((data) => data.fulfillment !== "DELIVERY" || (data.address ?? "").length > 3, {
    message: "validation.addressRequired",
    path: ["address"],
  });

export type CheckoutInput = z.input<typeof checkoutSchema>;

export const loginSchema = z.object({
  email: z.string().email("Неверный email"),
  password: z.string().min(1, "Введите пароль"),
});

export type LoginInput = z.infer<typeof loginSchema>;

/** Первая ошибка по каждому полю: { "translations": "…", "slug": "…" } */
export function flattenZodError(error: z.ZodError): Record<string, string> {
  const result: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.map(String).join(".") || "form";
    const top = issue.path[0]?.toString() ?? "form";
    if (!result[key]) result[key] = issue.message;
    if (!result[top]) result[top] = issue.message;
  }
  return result;
}
