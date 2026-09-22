"use server";

import { buildPricedCart, type PricedCart } from "@/lib/cart-server";
import type { LocalCartItem } from "@/lib/cart-types";

/** Пересчёт корзины на сервере (цены, промо, промокод, 18+) для страницы корзины/чекаута. */
export async function getCartPricing(
  items: LocalCartItem[],
  locale: string,
  promoCode?: string | null
): Promise<PricedCart> {
  return buildPricedCart(items, locale, promoCode);
}
