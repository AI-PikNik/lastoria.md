"use client";

import * as React from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useCart } from "@/components/cart/cart-context";
import { useAgeGate } from "@/components/age-gate/age-gate-context";
import { formatMoney } from "@/lib/format";
import { Minus, Plus } from "lucide-react";

export interface VariantOption {
  name: string;
  priceDelta: number;
}

interface ProductPurchasePanelProps {
  productId: string;
  name: string;
  basePrice: number;
  isAlcohol: boolean;
  variants: VariantOption[];
}

export function ProductPurchasePanel({
  productId,
  name,
  basePrice,
  isAlcohol,
  variants,
}: ProductPurchasePanelProps) {
  const { addItem } = useCart();
  const { requestConfirmation } = useAgeGate();
  const [variant, setVariant] = React.useState<string | null>(
    variants.length > 0 ? variants[0].name : null
  );
  const [qty, setQty] = React.useState(1);

  const selectedVariant = variants.find((v) => v.name === variant);
  const unitPrice = basePrice + (selectedVariant?.priceDelta ?? 0);

  const handleAdd = async () => {
    if (isAlcohol) {
      const ok = await requestConfirmation();
      if (!ok) return;
    }
    addItem({ productId, variantName: variant, qty });
    toast.success(`${name} добавлен в корзину`);
  };

  return (
    <div className="flex flex-col gap-4">
      {variants.length > 0 && (
        <div>
          <p className="mb-2 text-sm font-medium">Вариант</p>
          <div className="flex flex-wrap gap-2">
            {variants.map((v) => (
              <button
                key={v.name}
                type="button"
                onClick={() => setVariant(v.name)}
                className={`rounded-md border px-3 py-1.5 text-sm ${
                  variant === v.name
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-input bg-card hover:bg-secondary"
                }`}
              >
                {v.name}
                {v.priceDelta !== 0 && ` (+${formatMoney(v.priceDelta)})`}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center gap-4">
        <div className="flex items-center rounded-md border border-input">
          <button
            type="button"
            aria-label="Уменьшить количество"
            className="flex h-10 w-10 items-center justify-center hover:bg-secondary"
            onClick={() => setQty((q) => Math.max(1, q - 1))}
          >
            <Minus className="h-4 w-4" />
          </button>
          <span className="w-8 text-center text-sm font-medium" aria-live="polite">
            {qty}
          </span>
          <button
            type="button"
            aria-label="Увеличить количество"
            className="flex h-10 w-10 items-center justify-center hover:bg-secondary"
            onClick={() => setQty((q) => Math.min(50, q + 1))}
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
        <span className="text-2xl font-semibold text-primary">
          {formatMoney(unitPrice * qty)}
        </span>
      </div>

      <Button size="lg" onClick={handleAdd}>
        Добавить в корзину
      </Button>
    </div>
  );
}
