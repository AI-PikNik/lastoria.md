"use client";

import Link from "next/link";
import { ShoppingCart } from "lucide-react";
import { useCart } from "@/components/cart/cart-context";

export function HeaderCartLink() {
  const { totalQty } = useCart();

  return (
    <Link
      href="/cart"
      className="relative flex h-10 w-10 items-center justify-center rounded-md hover:bg-secondary"
      aria-label={`Корзина, товаров: ${totalQty}`}
    >
      <ShoppingCart className="h-5 w-5" />
      {totalQty > 0 && (
        <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-xs font-semibold text-primary-foreground">
          {totalQty}
        </span>
      )}
    </Link>
  );
}
