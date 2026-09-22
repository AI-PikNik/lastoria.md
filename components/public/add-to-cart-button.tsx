"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Check, Plus } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { useCart } from "@/components/cart/cart-context";
import { useAgeGate } from "@/components/age-gate/age-gate-context";
import { useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

interface AddToCartButtonProps {
  productId: string;
  name: string;
  ageRestricted: boolean;
  variantKey?: string | null;
  qty?: number;
  className?: string;
  size?: ButtonProps["size"];
  /** full — «Добавить в корзину», short — «В корзину» */
  label?: "full" | "short";
}

export function AddToCartButton({
  productId,
  name,
  ageRestricted,
  variantKey,
  qty = 1,
  className,
  size = "default",
  label = "short",
}: AddToCartButtonProps) {
  const t = useTranslations("product");
  const tCart = useTranslations("cart");
  const router = useRouter();
  const { addItem } = useCart();
  const { requestConfirmation } = useAgeGate();
  const [pending, setPending] = React.useState(false);
  const [justAdded, setJustAdded] = React.useState(false);

  React.useEffect(() => {
    if (!justAdded) return;
    const timer = window.setTimeout(() => setJustAdded(false), 1500);
    return () => window.clearTimeout(timer);
  }, [justAdded]);

  const handleClick = async () => {
    if (ageRestricted) {
      setPending(true);
      const ok = await requestConfirmation();
      setPending(false);
      if (!ok) return;
    }
    addItem({ productId, variantKey: variantKey ?? null, qty });
    setJustAdded(true);
    toast.success(t("added", { name }), {
      action: { label: tCart("title"), onClick: () => router.push("/cart") },
    });
  };

  return (
    <Button
      type="button"
      size={size}
      className={cn("shrink-0", className)}
      onClick={handleClick}
      disabled={pending}
      aria-label={`${t("addToCartFull")}: ${name}`}
    >
      {justAdded ? <Check aria-hidden="true" /> : <Plus aria-hidden="true" />}
      <span>{label === "full" ? t("addToCartFull") : t("addToCart")}</span>
    </Button>
  );
}
