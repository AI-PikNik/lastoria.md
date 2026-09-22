"use client";

import { useTranslations } from "next-intl";
import { ShoppingBag } from "lucide-react";
import { Link, usePathname } from "@/i18n/navigation";
import { useCart } from "@/components/cart/cart-context";

/** Нижняя плашка корзины на телефоне/планшете (на десктопе корзина — в шапке) */
export function StickyCartBar() {
  const t = useTranslations("cart");
  const { totalQty } = useCart();
  const pathname = usePathname();

  if (totalQty === 0 || pathname === "/cart" || pathname === "/checkout") return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border-strong bg-background/95 px-3 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] shadow-[0_-8px_24px_-12px_rgba(43,33,24,0.35)] backdrop-blur lg:hidden">
      <Link
        href="/cart"
        className="mx-auto flex h-12 max-w-xl items-center justify-between gap-3 rounded-lg bg-primary px-4 text-primary-foreground shadow-sm active:bg-primary-hover"
      >
        <span className="flex items-center gap-2 font-semibold">
          <ShoppingBag className="size-5" aria-hidden="true" />
          {t("stickyCount", { count: totalQty })}
        </span>
        <span className="text-sm font-semibold underline-offset-2">{t("checkout")} →</span>
      </Link>
    </div>
  );
}
