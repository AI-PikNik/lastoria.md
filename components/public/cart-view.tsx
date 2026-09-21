"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { Minus, Plus, Trash2 } from "lucide-react";
import { useCart } from "@/components/cart/cart-context";
import { getCartPricing, type PricedCart } from "@/lib/actions/cart-pricing";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatMoney } from "@/lib/format";
import { toast } from "sonner";

export function CartView() {
  const { items, updateQty, removeItem } = useCart();
  const [pricing, setPricing] = React.useState<PricedCart | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) setLoading(true);
    });
    getCartPricing(items).then((result) => {
      if (cancelled) return;
      setPricing(result);
      setLoading(false);
      if (result.removedProductIds.length > 0) {
        result.removedProductIds.forEach((id) => removeItem(id));
        toast.warning("Некоторые товары были удалены из корзины: больше не доступны");
      }
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  if (loading && !pricing) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (!pricing || pricing.lines.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border p-10 text-center">
        <p className="text-lg font-medium">Корзина пуста</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Загляните в меню и выберите что-нибудь вкусное.
        </p>
        <Button asChild className="mt-4">
          <Link href="/menu">Перейти в меню</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="grid gap-8 md:grid-cols-[1fr_320px]">
      <div className="space-y-4">
        {pricing.lines.map((line) => (
          <div
            key={`${line.productId}:${line.variantName ?? ""}`}
            className="flex gap-4 rounded-xl border border-border bg-card p-4"
          >
            <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-md bg-muted">
              {line.imageUrl && (
                <Image src={line.imageUrl} alt={line.name} fill sizes="80px" className="object-cover" />
              )}
            </div>
            <div className="flex flex-1 flex-col gap-1">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <Link href={`/menu/${line.slug}`} className="font-medium hover:text-primary">
                    {line.name}
                  </Link>
                  {line.variantName && (
                    <p className="text-xs text-muted-foreground">{line.variantName}</p>
                  )}
                </div>
                <button
                  type="button"
                  aria-label={`Удалить ${line.name} из корзины`}
                  onClick={() => removeItem(line.productId, line.variantName)}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-auto flex items-center justify-between">
                <div className="flex items-center rounded-md border border-input">
                  <button
                    type="button"
                    aria-label="Уменьшить количество"
                    className="flex h-8 w-8 items-center justify-center hover:bg-secondary"
                    onClick={() => updateQty(line.productId, line.variantName, line.qty - 1)}
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                  <span className="w-8 text-center text-sm">{line.qty}</span>
                  <button
                    type="button"
                    aria-label="Увеличить количество"
                    className="flex h-8 w-8 items-center justify-center hover:bg-secondary"
                    onClick={() => updateQty(line.productId, line.variantName, line.qty + 1)}
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="text-right">
                  {line.discount > 0 && (
                    <span className="mr-2 text-xs text-muted-foreground line-through">
                      {formatMoney(line.originalLineTotal)}
                    </span>
                  )}
                  <span className="font-semibold text-primary">{formatMoney(line.lineTotal)}</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <aside className="h-fit space-y-4 rounded-xl border border-border bg-card p-6">
        <h2 className="font-display font-semibold">Итого</h2>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Товары</span>
            <span>{formatMoney(pricing.subtotal)}</span>
          </div>
          {pricing.discountTotal > 0 && (
            <div className="flex justify-between text-primary">
              <span>Скидка</span>
              <span>−{formatMoney(pricing.discountTotal)}</span>
            </div>
          )}
          {pricing.appliedPromos.map((promo) => (
            <p key={promo.id} className="text-xs text-muted-foreground">
              Промо «{promo.name}»: −{formatMoney(promo.discountAmount)}
            </p>
          ))}
          <div className="flex justify-between border-t border-border pt-2 text-base font-semibold">
            <span>К оплате</span>
            <span>{formatMoney(pricing.total)}</span>
          </div>
          <p className="text-xs text-muted-foreground">Доставка рассчитывается при оформлении</p>
        </div>
        <Button asChild className="w-full" size="lg">
          <Link href="/checkout">Оформить заказ</Link>
        </Button>
      </aside>
    </div>
  );
}
