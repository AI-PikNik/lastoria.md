"use client";

import Link from "next/link";
import { useCart } from "@/components/cart/cart-context";
import { ShoppingCart } from "lucide-react";

export function StickyCartBar() {
  const { totalQty } = useCart();

  if (totalQty === 0) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card p-3 shadow-lg md:hidden">
      <Link
        href="/cart"
        className="flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground"
      >
        <ShoppingCart className="h-4 w-4" />
        Перейти в корзину · {totalQty} тов.
      </Link>
    </div>
  );
}
