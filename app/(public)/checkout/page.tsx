import type { Metadata } from "next";
import { getSettings } from "@/lib/settings";
import { toNumber } from "@/lib/format";
import { CheckoutForm } from "@/components/public/checkout-form";

export const metadata: Metadata = {
  title: "Оформление заказа",
  robots: { index: false, follow: false },
};

export default async function CheckoutPage() {
  const settings = await getSettings();
  const deliveryZones = Array.isArray(settings.deliveryZones)
    ? (settings.deliveryZones as unknown as { name: string; fee: number }[])
    : [];

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="mb-6 font-display text-3xl font-bold">Оформление заказа</h1>
      <CheckoutForm deliveryZones={deliveryZones} minOrderAmount={toNumber(settings.minOrderAmount)} />
    </div>
  );
}
