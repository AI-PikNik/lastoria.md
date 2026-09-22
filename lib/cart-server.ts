import "server-only";

import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/format";
import { calculateCartPricing, type CartPricingItemInput } from "@/lib/pricing";
import { fetchActivePromos, promosForCode } from "@/lib/pricing-data";
import { isAgeRestricted } from "@/lib/catalog";
import { pickLocalized, pickTranslation } from "@/lib/i18n/translate";
import { DEFAULT_LOCALE, isLocale, type AppLocale } from "@/lib/i18n/locales";
import { parseVariants } from "@/lib/variants";
import type { LocalCartItem } from "@/lib/cart-types";

export interface PricedCartLine {
  productId: string;
  variantKey: string | null;
  variantName: string | null;
  qty: number;
  name: string;
  slug: string;
  imageUrl: string | null;
  ageRestricted: boolean;
  unitPrice: number;
  originalLineTotal: number;
  discount: number;
  lineTotal: number;
}

export interface PricedCart {
  lines: PricedCartLine[];
  subtotal: number;
  discountTotal: number;
  total: number;
  appliedPromos: { id: string; name: string; discountAmount: number }[];
  removedProductIds: string[];
  /** Введённый промокод найден и действует */
  promoCodeValid: boolean | null;
  requiresAgeConfirm: boolean;
}

/** Серверный пересчёт корзины: цены и промо берутся только из БД. */
export async function resolveCartPricing(items: LocalCartItem[], promoCode?: string | null) {
  const safeItems = items.slice(0, 50);
  const products = safeItems.length
    ? await prisma.product.findMany({
        where: {
          id: { in: safeItems.map((i) => i.productId) },
          isActive: true,
          category: { isActive: true },
        },
        include: { translations: true, category: true },
      })
    : [];
  const productMap = new Map(products.map((p) => [p.id, p]));

  const removedProductIds: string[] = [];
  const validItems: LocalCartItem[] = [];
  for (const item of safeItems) {
    const product = productMap.get(item.productId);
    const qty = Math.min(Math.max(Math.trunc(item.qty), 0), 50);
    if (!product || qty <= 0) {
      removedProductIds.push(item.productId);
      continue;
    }
    const variants = parseVariants(product.variants);
    // Вариант, которого больше нет, — строка удаляется из корзины (а не продаётся по базовой цене)
    if (item.variantKey && !variants.some((v) => v.key === item.variantKey)) {
      removedProductIds.push(item.productId);
      continue;
    }
    // Товар с вариантами без выбранного варианта — берём первый вариант
    const variantKey = item.variantKey ?? variants[0]?.key ?? null;
    validItems.push({ productId: item.productId, variantKey, qty });
  }

  const pricingItems: CartPricingItemInput[] = validItems.map((item) => {
    const product = productMap.get(item.productId)!;
    const variant = parseVariants(product.variants).find((v) => v.key === item.variantKey);
    return {
      id: `${item.productId}:${item.variantKey ?? ""}`,
      productId: product.id,
      categoryId: product.categoryId,
      kind: product.category.kind,
      unitPrice: Math.max(toNumber(product.price) + (variant?.priceDelta ?? 0), 0),
      qty: item.qty,
    };
  });

  const allPromos = await fetchActivePromos();
  const promos = promosForCode(allPromos, promoCode);
  const result = calculateCartPricing(pricingItems, promos, new Date());
  const normalizedCode = promoCode?.trim().toUpperCase() || null;
  const promoCodeValid = normalizedCode
    ? allPromos.some((p) => p.code?.toUpperCase() === normalizedCode)
    : null;

  return { productMap, validItems, result, removedProductIds, promoCodeValid };
}

export async function buildPricedCart(
  items: LocalCartItem[],
  localeInput: string,
  promoCode?: string | null
): Promise<PricedCart> {
  const locale: AppLocale = isLocale(localeInput) ? localeInput : DEFAULT_LOCALE;
  if (!Array.isArray(items) || items.length === 0) {
    return {
      lines: [],
      subtotal: 0,
      discountTotal: 0,
      total: 0,
      appliedPromos: [],
      removedProductIds: [],
      promoCodeValid: null,
      requiresAgeConfirm: false,
    };
  }

  const { productMap, validItems, result, removedProductIds, promoCodeValid } =
    await resolveCartPricing(items, promoCode);

  const lines: PricedCartLine[] = result.items.map((item, index) => {
    const original = validItems[index];
    const product = productMap.get(original.productId)!;
    const variant = parseVariants(product.variants).find((v) => v.key === original.variantKey);
    const { values } = pickTranslation(product.translations, locale, ["name"] as const);
    return {
      productId: product.id,
      variantKey: original.variantKey ?? null,
      variantName: variant ? pickLocalized(variant.names, locale, variant.key) : null,
      qty: item.qty,
      name: values.name || product.slug,
      slug: product.slug,
      imageUrl: product.imageUrl,
      ageRestricted: isAgeRestricted(product),
      unitPrice: item.unitPrice,
      originalLineTotal: item.originalLineTotal,
      discount: item.discount,
      lineTotal: item.lineTotal,
    };
  });

  return {
    lines,
    subtotal: result.subtotal,
    discountTotal: result.discountTotal,
    total: result.total,
    appliedPromos: result.appliedPromos.map((p) => ({
      id: p.id,
      name: pickLocalized(p.publicNames, locale, p.name),
      discountAmount: p.discountAmount,
    })),
    removedProductIds,
    promoCodeValid,
    requiresAgeConfirm: lines.some((l) => l.ageRestricted),
  };
}
