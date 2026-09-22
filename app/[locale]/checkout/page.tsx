import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { resolveLocaleParam } from "@/lib/i18n/server";
import { getPublicSettings } from "@/lib/settings";
import { getDeliveryCities } from "@/lib/delivery-data";
import { CheckoutForm } from "@/components/public/checkout-form";
import { SectionTitle } from "@/theme/decor";

export async function generateMetadata({ params }: PageProps<"/[locale]/checkout">): Promise<Metadata> {
  const locale = await resolveLocaleParam(params);
  const t = await getTranslations({ locale, namespace: "checkout" });
  return { title: t("title"), robots: { index: false, follow: false } };
}

export default async function CheckoutPage({ params }: PageProps<"/[locale]/checkout">) {
  const locale = await resolveLocaleParam(params);
  const [t, settings, cities] = await Promise.all([
    getTranslations({ locale, namespace: "checkout" }),
    getPublicSettings(locale),
    getDeliveryCities(locale),
  ]);
  return (
    <div className="mx-auto max-w-6xl px-4 pt-6">
      <SectionTitle as="h1" title={t("title")} className="mb-6" />
      <CheckoutForm cities={cities} minOrderAmount={settings.minOrderAmount} pickupAddress={settings.address} />
    </div>
  );
}
