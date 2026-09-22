import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { resolveLocaleParam } from "@/lib/i18n/server";
import { getPublicSettings } from "@/lib/settings";
import { getCategories } from "@/lib/catalog";
import { getMenuGroups } from "@/lib/menu-data";
import { buildMetadata, menuJsonLd } from "@/lib/seo";
import { JsonLd } from "@/components/seo/json-ld";
import { Breadcrumbs } from "@/components/public/breadcrumbs";
import { MenuBrowser } from "@/components/public/menu-browser";
import { SectionTitle } from "@/theme/decor";

async function loadGroup(params: PageProps<"/[locale]/menu/group/[slug]">["params"]) {
  const locale = await resolveLocaleParam(params);
  const { slug } = await params;
  const categories = await getCategories(locale);
  const category = categories.find((c) => c.slug === slug);
  if (!category) notFound();
  return { locale, category, categories };
}

// Страницы товаров/групп создаются при первом запросе и кэшируются (ISR);
// правки в админке сбрасывают кэш сразу.
export function generateStaticParams() {
  return [];
}

export async function generateMetadata({ params }: PageProps<"/[locale]/menu/group/[slug]">): Promise<Metadata> {
  const { locale, category } = await loadGroup(params);
  const [settings, t] = await Promise.all([getPublicSettings(locale), getTranslations({ locale, namespace: "menu" })]);
  return buildMetadata({
    locale,
    path: `/menu/group/${category.slug}`,
    title: category.seoTitle || category.name,
    description:
      category.seoDescription ||
      category.description ||
      t("groupDescription", { group: category.name, brand: settings.name }),
    image: category.imageUrl,
    siteName: settings.name,
  });
}

export default async function MenuGroupPage({ params }: PageProps<"/[locale]/menu/group/[slug]">) {
  const { locale, category, categories } = await loadGroup(params);
  const [settings, t, tNav, menu] = await Promise.all([
    getPublicSettings(locale),
    getTranslations({ locale, namespace: "menu" }),
    getTranslations({ locale, namespace: "nav" }),
    getMenuGroups(locale, category),
  ]);

  return (
    <div className="mx-auto max-w-6xl px-4 pt-5">
      <JsonLd data={menuJsonLd(`${category.name} — ${settings.name}`, locale, menu.ld)} />
      <Breadcrumbs
        locale={locale}
        label={tNav("breadcrumbs")}
        items={[
          { name: tNav("home"), path: "/" },
          { name: t("title"), path: "/menu" },
          { name: category.name, path: `/menu/group/${category.slug}` },
        ]}
      />
      <SectionTitle
        as="h1"
        title={category.name}
        subtitle={category.description || undefined}
        className="my-6"
      />
      <MenuBrowser
        locale={locale}
        groups={menu.groups}
        allGroups={categories.map((c) => ({ slug: c.slug, name: c.name }))}
        currentSlug={category.slug}
      />
    </div>
  );
}
