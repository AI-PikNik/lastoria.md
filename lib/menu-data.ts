import "server-only";
import { getCategories, getProductCards, type CategoryView } from "@/lib/catalog";
import type { AppLocale } from "@/lib/i18n/locales";
import type { MenuGroup } from "@/components/public/menu-browser";
import type { MenuLdSection } from "@/lib/seo";

/** Меню, сгруппированное по группам (в порядке из админки). */
export async function getMenuGroups(locale: AppLocale, onlyCategory?: CategoryView) {
  const [categories, products] = await Promise.all([
    getCategories(locale),
    getProductCards(locale, onlyCategory ? { categoryId: onlyCategory.id } : {}),
  ]);
  const source = onlyCategory ? [onlyCategory] : categories;
  const groups: MenuGroup[] = source
    .map((c) => ({
      id: c.id,
      slug: c.slug,
      name: c.name,
      products: products.filter((p) => p.categoryId === c.id),
    }))
    .filter((g) => g.products.length > 0);

  const ld: MenuLdSection[] = groups.map((g) => ({
    name: g.name,
    path: `/menu/group/${g.slug}`,
    items: g.products.map((p) => ({
      name: p.name,
      description: p.shortDescription,
      path: `/menu/${p.slug}`,
      price: p.price,
      image: p.imageUrl,
    })),
  }));

  return { categories, groups, ld };
}
