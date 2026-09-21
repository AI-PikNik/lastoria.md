"use server";

import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/format";
import { calculateCartPricing, type CartPricingItemInput } from "@/lib/pricing";
import { fetchActivePromos } from "@/lib/pricing-data";
import type { LocalCartItem } from "@/lib/cart-types";

export interface PricedCartLine {
  productId: string;
  variantName: string | null;
  qty: number;
  name: string;
  slug: string;
  imageUrl: string | null;
  isAlcohol: boolean;
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
}

interface VariantDef {
  name: string;
  priceDelta: number;
}

export async function resolveCartPricing(items: LocalCartItem[]) {
  const products = items.length
    ? await prisma.product.findMany({
        where: { id: { in: items.map((i) => i.productId) }, isActive: true },
      })
    : [];
  const productMap = new Map(products.map((p) => [p.id, p]));
  const removedProductIds = items
    .map((i) => i.productId)
    .filter((id) => !productMap.has(id));

  const validItems = items.filter((i) => productMap.has(i.productId));

  const pricingItems: CartPricingItemInput[] = validItems.map((item) => {
    const product = productMap.get(item.productId)!;
    const variants = Array.isArray(product.variants)
      ? (product.variants as unknown as VariantDef[])
      : [];
    const variant = item.variantName
      ? variants.find((v) => v.name === item.variantName)
      : undefined;
    const unitPrice = toNumber(product.price) + (variant?.priceDelta ?? 0);

    return {
      id: `${item.productId}:${item.variantName ?? ""}`,
      productId: product.id,
      categoryId: product.categoryId,
      type: product.type,
      unitPrice,
      qty: item.qty,
    };
  });

  const promos = await fetchActivePromos();
  const result = calculateCartPricing(pricingItems, promos, new Date());

  return { productMap, validItems, pricingItems, promos, result, removedProductIds };
}

export async function getCartPricing(items: LocalCartItem[]): Promise<PricedCart> {
  if (items.length === 0) {
    return {
      lines: [],
      subtotal: 0,
      discountTotal: 0,
      total: 0,
      appliedPromos: [],
      removedProductIds: [],
    };
  }

  const { productMap, validItems, result, removedProductIds } =
    await resolveCartPricing(items);

  const lines: PricedCartLine[] = result.items.map((item, index) => {
    const original = validItems[index];
    const product = productMap.get(original.productId)!;
    return {
      productId: product.id,
      variantName: original.variantName ?? null,
      qty: item.qty,
      name: product.name,
      slug: product.slug,
      imageUrl: product.imageUrl,
      isAlcohol: product.isAlcohol,
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
      name: p.name,
      discountAmount: p.discountAmount,
    })),
    removedProductIds,
  };
}
