"use client";

import * as React from "react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { Minus, Plus, Tag, Trash2 } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { useCart } from "@/components/cart/cart-context";
import { usePricedCart } from "@/components/cart/use-priced-cart";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { formatMoney } from "@/lib/format";
import type { AppLocale } from "@/lib/i18n/locales";
import { cn } from "@/lib/utils";

export function CartView({ minOrderAmount }: { minOrderAmount: number }) {
  const t = useTranslations("cart");
  const locale = useLocale() as AppLocale;
  const { items, hydrated, updateQty, removeItem, promoCode, setPromoCode } = useCart();
  const { data, loading, removedNotice } = usePricedCart();
  const [codeDraft, setCodeDraft] = React.useState("");

  React.useEffect(() => {
    queueMicrotask(() => setCodeDraft(promoCode));
  }, [promoCode]);

  const money = (v: number) => formatMoney(v, locale);

  if (hydrated && items.length === 0) {
    return (
      <div className="plaque mx-auto max-w-lg px-6 py-12 text-center">
        <p className="font-display text-2xl font-bold text-primary">{t("empty")}</p>
        <p className="mt-2 text-muted-foreground">{t("emptyText")}</p>
        <Link href="/menu" className={cn(buttonVariants({ size: "lg" }), "mt-6")}>
          {t("toMenu")}
        </Link>
      </div>
    );
  }

  const belowMin = data ? data.subtotal < minOrderAmount : false;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px] lg:items-start">
      <div className="space-y-3">
        {removedNotice && (
          <p role="status" className="rounded-lg border border-accent/40 bg-accent/10 p-3 text-sm">
            {t("removedWarning")}
          </p>
        )}
        {!data && loading
          ? items.map((item) => <Skeleton key={`${item.productId}:${item.variantKey}`} className="h-28 rounded-xl" />)
          : data?.lines.map((line) => (
              <article
                key={`${line.productId}:${line.variantKey ?? ""}`}
                className="flex gap-3 rounded-xl bg-card p-3 shadow-card gold-frame"
              >
                <Link
                  href={`/menu/${line.slug}`}
                  className="relative size-20 shrink-0 overflow-hidden rounded-lg bg-surface sm:size-24"
                  tabIndex={-1}
                  aria-hidden="true"
                >
                  {line.imageUrl && <Image src={line.imageUrl} alt="" fill sizes="96px" className="object-cover" />}
                </Link>
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <Link href={`/menu/${line.slug}`} className="font-display font-bold leading-snug hover:text-primary">
                        {line.name}
                      </Link>
                      {line.variantName && <p className="text-sm text-muted-foreground">{line.variantName}</p>}
                      {line.ageRestricted && (
                        <span className="mt-1 inline-block rounded-full bg-charcoal px-2 text-xs font-semibold text-cream">18+</span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => removeItem(line.productId, line.variantKey)}
                      className="-mr-1 -mt-1 flex size-11 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-surface hover:text-destructive"
                      aria-label={t("remove", { name: line.name })}
                    >
                      <Trash2 className="size-4" aria-hidden="true" />
                    </button>
                  </div>
                  <div className="mt-auto flex flex-wrap items-center justify-between gap-2">
                    <QtyStepper
                      qty={line.qty}
                      onChange={(qty) => updateQty(line.productId, line.variantKey, qty)}
                    />
                    <p className="text-right">
                      {line.discount > 0 && (
                        <s className="mr-2 text-sm text-muted-foreground">{money(line.originalLineTotal)}</s>
                      )}
                      <span className="font-display text-lg font-bold text-primary">{money(line.lineTotal)}</span>
                    </p>
                  </div>
                </div>
              </article>
            ))}
      </div>

      <aside className="plaque space-y-4 p-5 lg:sticky lg:top-28">
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            setPromoCode(codeDraft.trim());
          }}
        >
          <label htmlFor="promo-code" className="sr-only">
            {t("promoCode")}
          </label>
          <div className="relative flex-1">
            <Tag className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              id="promo-code"
              value={codeDraft}
              onChange={(e) => setCodeDraft(e.target.value.toUpperCase())}
              placeholder={t("promoCode")}
              className="pl-9 uppercase"
              autoComplete="off"
              maxLength={50}
            />
          </div>
          <Button type="submit" variant="outline">
            {t("applyCode")}
          </Button>
        </form>
        {data?.promoCodeValid === false && promoCode && (
          <p role="alert" className="-mt-2 text-sm text-destructive">
            {t("codeInvalid")}
          </p>
        )}

        <dl className="space-y-2 text-[0.95rem]">
          <div className="flex justify-between">
            <dt>{t("items")}</dt>
            <dd>{data ? money(data.subtotal) : "…"}</dd>
          </div>
          {data?.appliedPromos.map((promo) => (
            <div key={promo.id} className="flex justify-between gap-3 text-olive">
              <dt>{t("promo", { name: promo.name })}</dt>
              <dd className="shrink-0">−{money(promo.discountAmount)}</dd>
            </div>
          ))}
          <div className="flex justify-between border-t border-border-strong/50 pt-2 font-display text-xl font-bold">
            <dt>{t("total")}</dt>
            <dd className="text-primary">{data ? money(data.total) : "…"}</dd>
          </div>
        </dl>
        <p className="text-sm text-muted-foreground">{t("deliveryNote")}</p>
        {belowMin && (
          <p role="status" className="rounded-md bg-accent/10 p-3 text-sm text-brick">
            {t("belowMin", { amount: money(minOrderAmount) })}
          </p>
        )}
        <Link
          href="/checkout"
          aria-disabled={belowMin || !data}
          className={cn(
            buttonVariants({ size: "lg" }),
            "hidden w-full lg:flex",
            (belowMin || !data) && "pointer-events-none opacity-50"
          )}
        >
          {t("checkout")}
        </Link>
      </aside>

      {/* Телефон: кнопка оформления всегда под пальцем */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border-strong bg-background/95 px-3 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur lg:hidden">
        <Link
          href="/checkout"
          aria-disabled={belowMin || !data}
          className={cn(
            buttonVariants({ size: "lg" }),
            "mx-auto flex w-full max-w-xl justify-between",
            (belowMin || !data) && "pointer-events-none opacity-50"
          )}
        >
          <span>{t("checkout")}</span>
          <span>{data ? money(data.total) : "…"}</span>
        </Link>
      </div>
    </div>
  );
}

export function QtyStepper({ qty, onChange }: { qty: number; onChange: (qty: number) => void }) {
  const t = useTranslations("product");
  return (
    <div className="flex items-center rounded-lg border border-border-strong bg-background" role="group" aria-label={t("quantity")}>
      <button
        type="button"
        className="flex size-11 items-center justify-center rounded-l-lg hover:bg-surface"
        onClick={() => onChange(qty - 1)}
        aria-label={t("decrease")}
      >
        <Minus className="size-4" aria-hidden="true" />
      </button>
      <output className="w-8 text-center font-semibold" aria-live="polite">
        {qty}
      </output>
      <button
        type="button"
        className="flex size-11 items-center justify-center rounded-r-lg hover:bg-surface disabled:opacity-40"
        onClick={() => onChange(qty + 1)}
        disabled={qty >= 50}
        aria-label={t("increase")}
      >
        <Plus className="size-4" aria-hidden="true" />
      </button>
    </div>
  );
}
