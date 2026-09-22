import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { resolveLocaleParam } from "@/lib/i18n/server";
import { getPublicSettings } from "@/lib/settings";
import { CartView } from "@/components/public/cart-view";
import { SectionTitle } from "@/theme/decor";

export async function generateMetadata({ params }: PageProps<"/[locale]/cart">): Promise<Metadata> {
  const locale = await resolveLocaleParam(params);
  const t = await getTranslations({ locale, namespace: "cart" });
  return { title: t("title"), robots: { index: false, follow: false } };
}

export default async function CartPage({ params }: PageProps<"/[locale]/cart">) {
  const locale = await resolveLocaleParam(params);
  const [t, settings] = await Promise.all([getTranslations({ locale, namespace: "cart" }), getPublicSettings(locale)]);
  return (
    <div className="mx-auto max-w-6xl px-4 pt-6">
      <SectionTitle as="h1" title={t("title")} className="mb-6" />
      <CartView minOrderAmount={settings.minOrderAmount} />
    </div>
  );
}
