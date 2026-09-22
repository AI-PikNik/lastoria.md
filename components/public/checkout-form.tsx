"use client";

import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Bike, Store } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { useCart } from "@/components/cart/cart-context";
import { usePricedCart } from "@/components/cart/use-priced-cart";
import { createOrder } from "@/lib/actions/checkout";
import { computeDeliveryFee, type DeliveryCityView } from "@/lib/delivery";
import { formatMoney } from "@/lib/format";
import { isValidMoldovanPhone } from "@/lib/phone";
import type { AppLocale } from "@/lib/i18n/locales";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type Fulfillment = "DELIVERY" | "PICKUP";
type Payment = "CASH" | "CARD_ON_DELIVERY";

export function CheckoutForm({
  cities,
  minOrderAmount,
  pickupAddress,
}: {
  cities: DeliveryCityView[];
  minOrderAmount: number;
  pickupAddress: string;
}) {
  const t = useTranslations("checkout");
  const tRoot = useTranslations();
  const locale = useLocale() as AppLocale;
  const router = useRouter();
  const { items, promoCode, clear, hydrated } = useCart();
  const { data } = usePricedCart();

  const deliveryAvailable = cities.length > 0;
  const [fulfillment, setFulfillment] = React.useState<Fulfillment>(deliveryAvailable ? "DELIVERY" : "PICKUP");
  const [cityId, setCityId] = React.useState(cities[0]?.id ?? "");
  const [zoneId, setZoneId] = React.useState("");
  const [payment, setPayment] = React.useState<Payment>("CASH");
  const [ageConfirmed, setAgeConfirmed] = React.useState(false);
  const [phone, setPhone] = React.useState("");
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  const money = (v: number) => formatMoney(v, locale);
  const city = cities.find((c) => c.id === cityId);
  const zone = city?.zones.find((z) => z.id === zoneId);
  const itemsTotal = data?.total ?? 0;
  const deliveryFee = fulfillment === "DELIVERY" ? computeDeliveryFee(zone, itemsTotal) : 0;
  const grandTotal = itemsTotal + deliveryFee;
  const belowMin = data ? data.subtotal < minOrderAmount : false;

  React.useEffect(() => {
    if (hydrated && items.length === 0 && !pending) router.replace("/cart");
  }, [hydrated, items.length, pending, router]);

  const msg = (key: string | undefined, values?: Record<string, string | number>) =>
    key ? (key.startsWith("validation.") ? tRoot(key, values) : key) : undefined;

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const nextErrors: Record<string, string> = {};
    if (!isValidMoldovanPhone(phone)) nextErrors.phone = "validation.phoneInvalid";
    if (fulfillment === "DELIVERY" && deliveryAvailable && !zoneId) nextErrors.zoneId = "validation.zoneRequired";
    if (data?.requiresAgeConfirm && !ageConfirmed) nextErrors.ageConfirmed = "validation.ageRequired";
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      setFormError("validation.checkForm");
      document.getElementById(`field-${Object.keys(nextErrors)[0]}`)?.focus();
      return;
    }

    setPending(true);
    setErrors({});
    setFormError(null);
    const result = await createOrder({
      locale,
      customerName: String(form.get("customerName") ?? ""),
      phone,
      email: String(form.get("email") ?? ""),
      fulfillment,
      zoneId: fulfillment === "DELIVERY" ? zoneId : "",
      address: fulfillment === "DELIVERY" ? String(form.get("address") ?? "") : "",
      comment: String(form.get("comment") ?? ""),
      paymentMethod: payment,
      ageConfirmed,
      promoCode,
      items,
    });

    if (!result.ok || !result.orderToken) {
      setPending(false);
      setErrors(result.fieldErrors ?? {});
      setFormError(result.error ?? "validation.generic");
      toast.error(msg(result.error ?? "validation.generic", result.errorValues));
      return;
    }

    toast.success(t("success"));
    clear();
    router.push(`/order/${result.orderToken}`);
  };

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-6 lg:grid-cols-[1fr_380px] lg:items-start">
      <div className="space-y-6">
        {/* Контакты */}
        <Section title={t("contact")}>
          <Field id="field-customerName" label={t("name")} error={msg(errors.customerName)}>
            <Input
              id="field-customerName"
              name="customerName"
              autoComplete="name"
              required
              minLength={2}
              maxLength={200}
              aria-invalid={!!errors.customerName}
            />
          </Field>
          <Field id="field-phone" label={t("phone")} hint={t("phoneHint")} error={msg(errors.phone)}>
            <Input
              id="field-phone"
              name="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="+373 69 123 456"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              onBlur={() =>
                setErrors((prev) => {
                  const next = { ...prev };
                  if (phone && !isValidMoldovanPhone(phone)) next.phone = "validation.phoneInvalid";
                  else delete next.phone;
                  return next;
                })
              }
              aria-invalid={!!errors.phone}
            />
          </Field>
          <Field id="field-email" label={t("email")} error={msg(errors.email)}>
            <Input id="field-email" name="email" type="email" autoComplete="email" inputMode="email" />
          </Field>
        </Section>

        {/* Способ получения */}
        <Section title={t("fulfillment")}>
          <div role="radiogroup" aria-label={t("fulfillment")} className="grid grid-cols-2 gap-2">
            <Choice
              selected={fulfillment === "DELIVERY"}
              disabled={!deliveryAvailable}
              onSelect={() => setFulfillment("DELIVERY")}
              icon={<Bike />}
              label={t("delivery")}
            />
            <Choice
              selected={fulfillment === "PICKUP"}
              onSelect={() => setFulfillment("PICKUP")}
              icon={<Store />}
              label={t("pickup")}
            />
          </div>
          {!deliveryAvailable && <p className="text-sm text-muted-foreground">{t("noZones")}</p>}

          {fulfillment === "DELIVERY" && deliveryAvailable && (
            <>
              {cities.length > 1 && (
                <Field id="field-city" label={t("city")}>
                  <NativeSelect
                    id="field-city"
                    value={cityId}
                    onChange={(e) => {
                      setCityId(e.target.value);
                      setZoneId("");
                    }}
                  >
                    {cities.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </NativeSelect>
                </Field>
              )}
              <Field
                id="field-zoneId"
                label={cities.length > 1 ? t("zone") : `${t("zone")} · ${city?.name ?? ""}`}
                error={msg(errors.zoneId)}
              >
                <NativeSelect
                  id="field-zoneId"
                  value={zoneId}
                  onChange={(e) => setZoneId(e.target.value)}
                  aria-invalid={!!errors.zoneId}
                  required
                >
                  <option value="">{t("chooseZone")}</option>
                  {city?.zones.map((z) => (
                    <option key={z.id} value={z.id}>
                      {z.name} — {z.fee > 0 ? money(z.fee) : t("free")}
                      {z.freeFrom ? ` (${t("freeFrom", { amount: money(z.freeFrom) })})` : ""}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
              <Field id="field-address" label={t("address")} error={msg(errors.address)}>
                <Textarea
                  id="field-address"
                  name="address"
                  autoComplete="street-address"
                  rows={2}
                  placeholder={t("addressPlaceholder")}
                  required
                  aria-invalid={!!errors.address}
                />
              </Field>
            </>
          )}
          {fulfillment === "PICKUP" && (
            <p className="rounded-lg bg-surface p-3 text-sm">{t("pickupAt", { address: pickupAddress })}</p>
          )}
        </Section>

        {/* Оплата */}
        <Section title={t("payment")}>
          <div role="radiogroup" aria-label={t("payment")} className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Choice selected={payment === "CASH"} onSelect={() => setPayment("CASH")} label={t("cash")} />
            <Choice
              selected={payment === "CARD_ON_DELIVERY"}
              onSelect={() => setPayment("CARD_ON_DELIVERY")}
              label={t("cardOnDelivery")}
            />
          </div>
          <Field id="field-comment" label={t("comment")}>
            <Textarea id="field-comment" name="comment" rows={2} maxLength={1000} />
          </Field>
        </Section>
      </div>

      {/* Итог */}
      <aside className="plaque space-y-4 p-5 lg:sticky lg:top-28">
        <h2 className="font-display text-xl font-bold text-primary">{t("summary")}</h2>
        <ul className="space-y-1.5 text-sm">
          {data?.lines.map((line) => (
            <li key={`${line.productId}:${line.variantKey ?? ""}`} className="flex justify-between gap-3">
              <span>
                {line.name}
                {line.variantName ? ` (${line.variantName})` : ""} × {line.qty}
              </span>
              <span className="shrink-0">{money(line.lineTotal)}</span>
            </li>
          ))}
        </ul>
        <dl className="space-y-1.5 border-t border-border-strong/50 pt-3 text-[0.95rem]">
          <div className="flex justify-between">
            <dt>{t("items")}</dt>
            <dd>{data ? money(data.subtotal) : "…"}</dd>
          </div>
          {data && data.discountTotal > 0 && (
            <div className="flex justify-between text-olive">
              <dt>{tRoot("cart.discount")}</dt>
              <dd>−{money(data.discountTotal)}</dd>
            </div>
          )}
          {fulfillment === "DELIVERY" && (
            <div className="flex justify-between">
              <dt>{t("deliveryFee")}</dt>
              <dd>{zone ? (deliveryFee > 0 ? money(deliveryFee) : t("free")) : "—"}</dd>
            </div>
          )}
          <div className="flex justify-between border-t border-border-strong/50 pt-2 font-display text-xl font-bold">
            <dt>{t("total")}</dt>
            <dd className="text-primary">{data ? money(grandTotal) : "…"}</dd>
          </div>
        </dl>

        {minOrderAmount > 0 && (
          <p className={cn("text-sm", belowMin ? "font-semibold text-brick" : "text-muted-foreground")}>
            {t("minOrder", { amount: money(minOrderAmount) })}
          </p>
        )}

        {data?.requiresAgeConfirm && (
          <div className="rounded-lg border border-charcoal/30 bg-card p-3">
            <label htmlFor="field-ageConfirmed" className="flex min-h-11 cursor-pointer items-start gap-3">
              <Checkbox
                id="field-ageConfirmed"
                checked={ageConfirmed}
                onCheckedChange={(v) => setAgeConfirmed(v === true)}
                aria-invalid={!!errors.ageConfirmed}
                className="mt-0.5"
              />
              <span>
                <span className="font-semibold">{t("ageConfirm")}</span>
                <span className="block text-sm text-muted-foreground">{t("ageConfirmHint")}</span>
              </span>
            </label>
            {errors.ageConfirmed && <p className="mt-1 text-sm text-destructive">{msg(errors.ageConfirmed)}</p>}
          </div>
        )}

        {formError && (
          <p role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {msg(formError)}
          </p>
        )}

        <Button type="submit" size="lg" className="w-full" disabled={pending || !data || belowMin}>
          {pending ? t("submitting") : t("submit")}
        </Button>
      </aside>
    </form>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="space-y-4 rounded-xl bg-card p-4 shadow-card gold-frame sm:p-5">
      <legend className="float-left mb-1 w-full font-display text-lg font-bold text-primary">{title}</legend>
      <div className="clear-both space-y-4">{children}</div>
    </fieldset>
  );
}

function Field({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-semibold">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="text-sm text-destructive">
          {error}
        </p>
      ) : (
        hint && <p className="text-xs text-muted-foreground">{hint}</p>
      )}
    </div>
  );
}

function Choice({
  selected,
  disabled,
  onSelect,
  label,
  icon,
}: {
  selected: boolean;
  disabled?: boolean;
  onSelect: () => void;
  label: string;
  icon?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        "flex min-h-12 items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold transition-colors disabled:opacity-40 [&_svg]:size-5",
        selected ? "border-primary bg-primary text-primary-foreground" : "border-border-strong bg-background hover:bg-surface"
      )}
    >
      {icon}
      {label}
    </button>
  );
}
