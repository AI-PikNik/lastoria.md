import "server-only";
import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/format";
import {
  calculateCartPricing,
  type CartPricingItemInput,
  type CartPricingPromoInput,
} from "@/lib/pricing";
import type { Product } from "@/lib/generated/prisma/client";

export async function fetchActivePromos(): Promise<CartPricingPromoInput[]> {
  const now = new Date();
  const promos = await prisma.promo.findMany({
    where: { isActive: true, startsAt: { lte: now }, endsAt: { gte: now } },
  });

  return promos.map((promo) => ({
    id: promo.id,
    name: promo.name,
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
  }));
}

export interface ProductPricing {
  price: number;
  oldPrice: number | null;
  hasDiscount: boolean;
}

/**
 * Считает отображаемую цену товара в каталоге с учётом активных промо
 * (по одной единице товара — для превью в списке/карточке).
 */
export function computeCatalogPricing(
  products: Pick<Product, "id" | "categoryId" | "type" | "price" | "oldPrice">[],
  promos: CartPricingPromoInput[]
): Map<string, ProductPricing> {
  const items: CartPricingItemInput[] = products.map((p) => ({
    id: p.id,
    productId: p.id,
    categoryId: p.categoryId,
    type: p.type,
    unitPrice: toNumber(p.price),
    qty: 1,
  }));

  const result = calculateCartPricing(items, promos, new Date());
  const map = new Map<string, ProductPricing>();

  result.items.forEach((item, index) => {
    const product = products[index];
    const basePrice = toNumber(product.price);
    map.set(product.id, {
      price: item.lineTotal,
      oldPrice: item.discount > 0 ? basePrice : product.oldPrice ? toNumber(product.oldPrice) : null,
      hasDiscount: item.discount > 0,
    });
  });

  return map;
}
