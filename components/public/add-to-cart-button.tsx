"use client";

import * as React from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useCart } from "@/components/cart/cart-context";
import { useAgeGate } from "@/components/age-gate/age-gate-context";

interface AddToCartButtonProps {
  productId: string;
  name: string;
  isAlcohol: boolean;
  variantName?: string | null;
  qty?: number;
  className?: string;
  size?: "default" | "sm" | "lg";
}

export function AddToCartButton({
  productId,
  name,
  isAlcohol,
  variantName,
  qty = 1,
  className,
  size = "default",
}: AddToCartButtonProps) {
  const { addItem } = useCart();
  const { requestConfirmation } = useAgeGate();
  const [pending, setPending] = React.useState(false);

  const handleClick = async () => {
    if (isAlcohol) {
      setPending(true);
      const ok = await requestConfirmation();
      setPending(false);
      if (!ok) return;
    }
    addItem({ productId, variantName: variantName ?? null, qty });
    toast.success(`${name} добавлен в корзину`);
  };

  return (
    <Button
      type="button"
      size={size}
      className={className}
      onClick={handleClick}
      disabled={pending}
    >
      В корзину
    </Button>
  );
}
