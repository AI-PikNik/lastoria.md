"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useCart } from "@/components/cart/cart-context";
import { getCartPricing, type PricedCart } from "@/lib/actions/cart-pricing";
import { createOrder } from "@/lib/actions/checkout";
import { checkoutSchema } from "@/lib/validation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatMoney } from "@/lib/format";

interface DeliveryZone {
  name: string;
  fee: number;
}

export function CheckoutForm({
  deliveryZones,
  minOrderAmount,
}: {
  deliveryZones: DeliveryZone[];
  minOrderAmount: number;
}) {
  const { items, clear } = useCart();
  const router = useRouter();
  const [pricing, setPricing] = React.useState<PricedCart | null>(null);
  const [fulfillment, setFulfillment] = React.useState<"DELIVERY" | "PICKUP">("DELIVERY");
  const [zone, setZone] = React.useState(deliveryZones[0]?.name ?? "");
  const [paymentMethod, setPaymentMethod] = React.useState<"CASH" | "CARD_ON_DELIVERY">("CASH");
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [submitting, setSubmitting] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);

  React.useEffect(() => {
    getCartPricing(items).then(setPricing);
  }, [items]);

  const deliveryFee =
    fulfillment === "DELIVERY" ? deliveryZones.find((z) => z.name === zone)?.fee ?? 0 : 0;
  const total = (pricing?.total ?? 0) + deliveryFee;
  const belowMinimum = (pricing?.subtotal ?? 0) < minOrderAmount;

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);
    setErrors({});

    const formData = new FormData(event.currentTarget);
    const raw = {
      customerName: formData.get("customerName") ?? "",
      phone: formData.get("phone") ?? "",
      email: formData.get("email") ?? "",
      fulfillment,
      address: formData.get("address") ?? "",
      deliveryZone: zone,
      comment: formData.get("comment") ?? "",
      paymentMethod,
      items: items.map((i) => ({
        productId: i.productId,
        variantName: i.variantName ?? undefined,
        qty: i.qty,
      })),
    };

    const parsed = checkoutSchema.safeParse(raw);
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0]?.toString() ?? "form";
        if (!fieldErrors[key]) fieldErrors[key] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }

    setSubmitting(true);
    try {
      const result = await createOrder(raw);
      if (!result.ok) {
        setFormError(result.error ?? "Не удалось оформить заказ");
        if (result.fieldErrors) setErrors(result.fieldErrors);
        return;
      }
      clear();
      toast.success("Заказ принят! Ожидайте звонка оператора");
      router.push(`/order/${result.orderToken}`);
    } catch {
      setFormError("Произошла ошибка. Попробуйте ещё раз.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="grid gap-8 md:grid-cols-[1fr_320px]">
      <div className="space-y-5">
        <div>
          <Label htmlFor="customerName">Имя</Label>
          <Input id="customerName" name="customerName" required autoComplete="name" />
          {errors.customerName && <p className="mt-1 text-xs text-destructive">{errors.customerName}</p>}
        </div>

        <div>
          <Label htmlFor="phone">Телефон</Label>
          <Input id="phone" name="phone" required autoComplete="tel" placeholder="+373 6X XXX XXX" />
          {errors.phone && <p className="mt-1 text-xs text-destructive">{errors.phone}</p>}
        </div>

        <div>
          <Label htmlFor="email">Email (необязательно)</Label>
          <Input id="email" name="email" type="email" autoComplete="email" />
          {errors.email && <p className="mt-1 text-xs text-destructive">{errors.email}</p>}
        </div>

        <div>
          <Label>Способ получения</Label>
          <div className="mt-2 flex gap-3">
            <RadioCard
              label="Доставка"
              selected={fulfillment === "DELIVERY"}
              onClick={() => setFulfillment("DELIVERY")}
            />
            <RadioCard
              label="Самовывоз"
              selected={fulfillment === "PICKUP"}
              onClick={() => setFulfillment("PICKUP")}
            />
          </div>
        </div>

        {fulfillment === "DELIVERY" && (
          <>
            {deliveryZones.length > 0 && (
              <div>
                <Label htmlFor="zone">Зона доставки</Label>
                <Select value={zone} onValueChange={setZone}>
                  <SelectTrigger id="zone">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {deliveryZones.map((z) => (
                      <SelectItem key={z.name} value={z.name}>
                        {z.name} — {formatMoney(z.fee)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label htmlFor="address">Адрес доставки</Label>
              <Input id="address" name="address" required autoComplete="street-address" />
              {errors.address && <p className="mt-1 text-xs text-destructive">{errors.address}</p>}
            </div>
          </>
        )}

        <div>
          <Label>Способ оплаты</Label>
          <div className="mt-2 flex gap-3">
            <RadioCard
              label="Наличными"
              selected={paymentMethod === "CASH"}
              onClick={() => setPaymentMethod("CASH")}
            />
            <RadioCard
              label="Картой курьеру"
              selected={paymentMethod === "CARD_ON_DELIVERY"}
              onClick={() => setPaymentMethod("CARD_ON_DELIVERY")}
            />
          </div>
        </div>

        <div>
          <Label htmlFor="comment">Комментарий к заказу</Label>
          <Textarea id="comment" name="comment" rows={3} />
        </div>
      </div>

      <aside className="h-fit space-y-4 rounded-xl border border-border bg-card p-6">
        <h2 className="font-display font-semibold">Ваш заказ</h2>
        <div className="space-y-1 text-sm">
          {pricing?.lines.map((line) => (
            <div key={`${line.productId}:${line.variantName ?? ""}`} className="flex justify-between">
              <span className="text-muted-foreground">
                {line.name} × {line.qty}
              </span>
              <span>{formatMoney(line.lineTotal)}</span>
            </div>
          ))}
          <div className="flex justify-between border-t border-border pt-2">
            <span className="text-muted-foreground">Товары</span>
            <span>{formatMoney(pricing?.subtotal ?? 0)}</span>
          </div>
          {(pricing?.discountTotal ?? 0) > 0 && (
            <div className="flex justify-between text-primary">
              <span>Скидка</span>
              <span>−{formatMoney(pricing?.discountTotal ?? 0)}</span>
            </div>
          )}
          {fulfillment === "DELIVERY" && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Доставка</span>
              <span>{formatMoney(deliveryFee)}</span>
            </div>
          )}
          <div className="flex justify-between border-t border-border pt-2 text-base font-semibold">
            <span>Итого</span>
            <span>{formatMoney(total)}</span>
          </div>
        </div>

        {belowMinimum && (
          <p className="text-xs text-destructive">
            Минимальная сумма заказа — {formatMoney(minOrderAmount)}
          </p>
        )}
        {formError && <p className="text-sm text-destructive">{formError}</p>}

        <Button type="submit" className="w-full" size="lg" disabled={submitting || belowMinimum || !pricing?.lines.length}>
          {submitting ? "Отправка…" : "Подтвердить заказ"}
        </Button>
      </aside>
    </form>
  );
}

function RadioCard({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`flex-1 rounded-md border px-4 py-2 text-sm font-medium ${
        selected
          ? "border-primary bg-primary text-primary-foreground"
          : "border-input bg-card hover:bg-secondary"
      }`}
    >
      {label}
    </button>
  );
}
