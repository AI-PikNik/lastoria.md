import "server-only";
import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/format";
import {
  calculateCartPricing,
  type CartPricingPromoInput,
  type CategoryKindValue,
} from "@/lib/pricing";

function toPromoInput(promo: Awaited<ReturnType<typeof prisma.promo.findMany>>[number]): CartPricingPromoInput {
  return {
    id: promo.id,
    name: promo.name,
    publicNames:
      promo.publicNames && typeof promo.publicNames === "object"
        ? (promo.publicNames as Record<string, string>)
        : {},
    code: promo.code,
    type: promo.type,
    value: toNumber(promo.value),
    scope: promo.scope,
    targetIds: Array.isArray(promo.targetIds) ? (promo.targetIds as string[]) : [],
    minOrderAmount: promo.minOrderAmount != null ? toNumber(promo.minOrderAmount) : null,
    startsAt: promo.startsAt,
    endsAt: promo.endsAt,
    isActive: promo.isActive,
    stackable: promo.stackable,
  };
}

/** Все действующие сейчас промо (с кодом и без). */
export const fetchActivePromos = cache(async (): Promise<CartPricingPromoInput[]> => {
  const now = new Date();
  const promos = await prisma.promo.findMany({
    where: { isActive: true, startsAt: { lte: now }, endsAt: { gte: now } },
  });
  return promos.map(toPromoInput);
});

/**
 * Промо, которые применяются к корзине: автоматические (без кода) + промо
 * с кодом, если покупатель ввёл именно этот код (без учёта регистра).
 */
export function promosForCode(promos: CartPricingPromoInput[], code?: string | null) {
  const normalized = code?.trim().toUpperCase() || null;
  return promos.filter((p) => !p.code || (normalized !== null && p.code.toUpperCase() === normalized));
}

export interface ProductPricing {
  price: number;
  oldPrice: number | null;
  hasDiscount: boolean;
  /** Публичные названия промо, давшего скидку { ro, ru, en, it } */
  promoNames: Record<string, string> | null;
}

export interface CatalogPricingInput {
  id: string;
  categoryId: string;
  kind: CategoryKindValue;
  price: unknown;
  oldPrice: unknown;
}

/**
 * Цена товара в каталоге с учётом автоматических промо.
 * Считается по каждому товару отдельно (1 шт.) и без промо на всю корзину и
 * промокодов — они видны только в корзине, иначе цены в каталоге «врут».
 */
export function computeCatalogPricing(
  products: CatalogPricingInput[],
  promos: CartPricingPromoInput[]
): Map<string, ProductPricing> {
  const itemPromos = promos.filter((p) => p.scope !== "CART" && !p.code && p.minOrderAmount == null);
  const map = new Map<string, ProductPricing>();
  const now = new Date();

  for (const product of products) {
    const basePrice = toNumber(product.price);
    const result = calculateCartPricing(
      [
        {
          id: product.id,
          productId: product.id,
          categoryId: product.categoryId,
          kind: product.kind,
          unitPrice: basePrice,
          qty: 1,
        },
      ],
      itemPromos,
      now
    );
    const line = result.items[0];
    const applied = result.appliedPromos[0];
    map.set(product.id, {
      price: line.lineTotal,
      oldPrice: line.discount > 0 ? basePrice : product.oldPrice ? toNumber(product.oldPrice) : null,
      hasDiscount: line.discount > 0,
      promoNames: applied ? (applied.publicNames ?? {}) : null,
    });
  }
  return map;
}
