"use client";

import { useTranslations } from "next-intl";
import { ShoppingBag } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { useCart } from "@/components/cart/cart-context";

export function HeaderCartButton() {
  const t = useTranslations("header");
  const { totalQty } = useCart();

  return (
    <Link
      href="/cart"
      className="relative inline-flex h-11 items-center gap-2 rounded-md px-2.5 font-semibold text-foreground/90 hover:bg-surface hover:text-primary lg:border lg:border-border-strong lg:bg-card lg:px-4"
      aria-label={t("cartLabel", { count: totalQty })}
    >
      <ShoppingBag className="size-5" aria-hidden="true" />
      <span className="hidden lg:inline">{t("cart")}</span>
      {totalQty > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-xs font-bold text-primary-foreground lg:static lg:ml-0.5">
          {totalQty}
        </span>
      )}
    </Link>
  );
}
