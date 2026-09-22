"use client";

import * as React from "react";
import { useLocale } from "next-intl";
import { getCartPricing } from "@/lib/actions/cart-pricing";
import type { PricedCart } from "@/lib/cart-server";
import { useCart } from "./cart-context";

/** Цены корзины всегда считает сервер (промо, промокод, 18+, доступность товаров). */
export function usePricedCart() {
  const locale = useLocale();
  const { items, hydrated, promoCode, removeProducts } = useCart();
  const [data, setData] = React.useState<PricedCart | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [removedNotice, setRemovedNotice] = React.useState(false);
  const requestId = React.useRef(0);

  const key = JSON.stringify(items);

  React.useEffect(() => {
    if (!hydrated) return;
    const id = ++requestId.current;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const result = await getCartPricing(JSON.parse(key), locale, promoCode);
        if (id !== requestId.current) return;
        setData(result);
        if (result.removedProductIds.length > 0) {
          setRemovedNotice(true);
          removeProducts(result.removedProductIds);
        }
      } finally {
        if (id === requestId.current) setLoading(false);
      }
    }, 150);
    return () => window.clearTimeout(timer);
  }, [key, hydrated, locale, promoCode, removeProducts]);

  return { data, loading: loading || !hydrated, removedNotice };
}
