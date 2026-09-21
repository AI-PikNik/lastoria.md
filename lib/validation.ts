import { z } from "zod";

export const productTypeSchema = z.enum(["PIZZA", "DRINK", "ALCOHOL", "OTHER"]);
export const promoTypeSchema = z.enum(["PERCENT", "FIXED", "PRODUCT_OVERRIDE"]);
export const promoScopeSchema = z.enum([
  "PRODUCT",
  "CATEGORY",
  "PRODUCT_TYPE",
  "CART",
]);
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

const variantSchema = z.object({
  name: z.string().min(1, "Укажите название варианта"),
  priceDelta: z.coerce.number(),
});

export const productSchema = z.object({
  name: z.string().min(2, "Название должно быть не короче 2 символов").max(200),
  slug: z
    .string()
    .min(2, "Slug должен быть не короче 2 символов")
    .regex(/^[a-z0-9-]+$/, "Slug: только латиница, цифры и дефис"),
  description: z.string().max(20000).optional().default(""),
  shortDescription: z.string().max(500).optional().default(""),
  categoryId: z.string().min(1, "Выберите категорию"),
  type: productTypeSchema,
  price: z.coerce.number().positive("Цена должна быть больше нуля"),
  oldPrice: z.coerce.number().positive().nullable().optional(),
  isAlcohol: z.boolean().default(false),
  isVegetarian: z.boolean().default(false),
  isSpicy: z.boolean().default(false),
  isActive: z.boolean().default(true),
  isFeatured: z.boolean().default(false),
  sku: z.string().max(100).optional().default(""),
  sortOrder: z.coerce.number().int().default(0),
  stock: z.coerce.number().int().nullable().optional(),
  ingredients: z.array(z.string().min(1)).default([]),
  variants: z.array(variantSchema).optional().default([]),
  seoTitle: z.string().max(200).optional().default(""),
  seoDescription: z.string().max(500).optional().default(""),
  seoKeywords: z.string().max(300).optional().default(""),
});

export type ProductInput = z.infer<typeof productSchema>;

export const categorySchema = z.object({
  name: z.string().min(2).max(200),
  slug: z
    .string()
    .min(2)
    .regex(/^[a-z0-9-]+$/, "Slug: только латиница, цифры и дефис"),
  description: z.string().max(2000).optional().default(""),
  sortOrder: z.coerce.number().int().default(0),
  isActive: z.boolean().default(true),
  seoTitle: z.string().max(200).optional().default(""),
  seoDescription: z.string().max(500).optional().default(""),
});

export type CategoryInput = z.infer<typeof categorySchema>;

export const promoSchema = z
  .object({
    name: z.string().min(2).max(200),
    code: z.string().max(50).optional().default(""),
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
  });

export type PromoInput = z.infer<typeof promoSchema>;

export const settingsSchema = z.object({
  restaurantName: z.string().min(1),
  restaurantPhone: z.string().min(5),
  restaurantAddress: z.string().min(1),
  restaurantEmail: z.string().email().optional().or(z.literal("")),
  workingHours: z.string().min(1),
  minOrderAmount: z.coerce.number().min(0),
  seoDefaultTitle: z.string().min(1),
  seoDefaultDescription: z.string().min(1),
  telegramChatId: z.string().optional().or(z.literal("")),
  emailSenderAddress: z.string().email().optional().or(z.literal("")),
  deliveryZones: z
    .array(
      z.object({
        name: z.string().min(1),
        fee: z.coerce.number().min(0),
      })
    )
    .default([]),
});

export type SettingsInput = z.infer<typeof settingsSchema>;

const cartItemSchema = z.object({
  productId: z.string().min(1),
  variantName: z.string().optional().nullable(),
  qty: z.coerce.number().int().positive().max(50),
});

export const checkoutSchema = z.object({
  customerName: z.string().min(2, "Укажите имя").max(200),
  phone: z
    .string()
    .min(6, "Укажите телефон")
    .regex(/^[+0-9() -]{6,20}$/, "Неверный формат телефона"),
  email: z.string().email("Неверный email").optional().or(z.literal("")),
  fulfillment: fulfillmentSchema,
  address: z.string().max(500).optional().or(z.literal("")),
  deliveryZone: z.string().max(200).optional().or(z.literal("")),
  comment: z.string().max(1000).optional().or(z.literal("")),
  paymentMethod: paymentMethodSchema.default("CASH"),
  ageConfirmed: z.boolean().optional().default(false),
  items: z.array(cartItemSchema).min(1, "Корзина пуста"),
}).refine(
  (data) => data.fulfillment !== "DELIVERY" || (data.address && data.address.length > 3),
  { message: "Укажите адрес доставки", path: ["address"] }
);

export type CheckoutInput = z.infer<typeof checkoutSchema>;

export const loginSchema = z.object({
  email: z.string().email("Неверный email"),
  password: z.string().min(1, "Введите пароль"),
});

export type LoginInput = z.infer<typeof loginSchema>;
