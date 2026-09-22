"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Minus, Plus } from "lucide-react";
import type { AppLocale } from "@/lib/i18n/locales";
import type { PricedVariant } from "@/lib/catalog";
import { cn } from "@/lib/utils";
import { AddToCartButton } from "./add-to-cart-button";
import { Price } from "./price";

interface ProductPurchasePanelProps {
  productId: string;
  name: string;
  price: number;
  oldPrice: number | null;
  ageRestricted: boolean;
  variants: PricedVariant[];
  locale: AppLocale;
}

export function ProductPurchasePanel({
  productId,
  name,
  price,
  oldPrice,
  ageRestricted,
  variants,
  locale,
}: ProductPurchasePanelProps) {
  const t = useTranslations("product");
  const [variantKey, setVariantKey] = React.useState<string | null>(variants[0]?.key ?? null);
  const [qty, setQty] = React.useState(1);
  const variant = variants.find((v) => v.key === variantKey);
  const unitPrice = variant ? variant.price : price;
  const unitOld = variant ? variant.oldPrice : oldPrice;

  return (
    <div className="space-y-5">
      <Price price={unitPrice} oldPrice={unitOld} locale={locale} size="lg" />

      {variants.length > 0 && (
        <fieldset>
          <legend className="mb-2 text-sm font-semibold">{t("variant")}</legend>
          <div className="flex flex-wrap gap-2" role="radiogroup">
            {variants.map((v) => {
              const selected = v.key === variantKey;
              return (
                <button
                  key={v.key}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setVariantKey(v.key)}
                  className={cn(
                    "min-h-11 rounded-lg border px-4 py-2 text-left text-sm font-semibold transition-colors",
                    selected
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border-strong bg-card hover:bg-surface"
                  )}
                >
                  {v.name}
                </button>
              );
            })}
          </div>
        </fieldset>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center rounded-lg border border-border-strong bg-card" aria-label={t("quantity")} role="group">
          <button
            type="button"
            className="flex size-11 items-center justify-center rounded-l-lg hover:bg-surface disabled:opacity-40"
            onClick={() => setQty((q) => Math.max(1, q - 1))}
            disabled={qty <= 1}
            aria-label={t("decrease")}
          >
            <Minus className="size-4" aria-hidden="true" />
          </button>
          <output className="w-10 text-center font-semibold" aria-live="polite">
            {qty}
          </output>
          <button
            type="button"
            className="flex size-11 items-center justify-center rounded-r-lg hover:bg-surface disabled:opacity-40"
            onClick={() => setQty((q) => Math.min(50, q + 1))}
            disabled={qty >= 50}
            aria-label={t("increase")}
          >
            <Plus className="size-4" aria-hidden="true" />
          </button>
        </div>
        <AddToCartButton
          productId={productId}
          name={variant ? `${name} (${variant.name})` : name}
          ageRestricted={ageRestricted}
          variantKey={variantKey}
          qty={qty}
          size="lg"
          label="full"
          className="flex-1 sm:flex-none"
        />
      </div>
    </div>
  );
}
