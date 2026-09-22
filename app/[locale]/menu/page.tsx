import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { resolveLocaleParam } from "@/lib/i18n/server";
import { getPublicSettings } from "@/lib/settings";
import { getMenuGroups } from "@/lib/menu-data";
import { buildMetadata, menuJsonLd } from "@/lib/seo";
import { JsonLd } from "@/components/seo/json-ld";
import { Breadcrumbs } from "@/components/public/breadcrumbs";
import { MenuBrowser } from "@/components/public/menu-browser";
import { SectionTitle } from "@/theme/decor";

export async function generateMetadata({ params }: PageProps<"/[locale]/menu">): Promise<Metadata> {
  const locale = await resolveLocaleParam(params);
  const [settings, t] = await Promise.all([getPublicSettings(locale), getTranslations({ locale, namespace: "menu" })]);
  return buildMetadata({
    locale,
    path: "/menu",
    title: t("title"),
    description: t("description", { brand: settings.name }),
    siteName: settings.name,
  });
}

export default async function MenuPage({ params }: PageProps<"/[locale]/menu">) {
  const locale = await resolveLocaleParam(params);
  const [settings, t, tNav, menu] = await Promise.all([
    getPublicSettings(locale),
    getTranslations({ locale, namespace: "menu" }),
    getTranslations({ locale, namespace: "nav" }),
    getMenuGroups(locale),
  ]);

  return (
    <div className="mx-auto max-w-6xl px-4 pt-5">
      <JsonLd data={menuJsonLd(`${t("title")} ${settings.name}`, locale, menu.ld)} />
      <Breadcrumbs
        locale={locale}
        label={tNav("breadcrumbs")}
        items={[
          { name: tNav("home"), path: "/" },
          { name: t("title"), path: "/menu" },
        ]}
      />
      <SectionTitle as="h1" title={t("title")} subtitle={t("subtitle")} className="my-6" />
      <MenuBrowser
        locale={locale}
        groups={menu.groups}
        allGroups={menu.categories.map((c) => ({ slug: c.slug, name: c.name }))}
      />
    </div>
  );
}
