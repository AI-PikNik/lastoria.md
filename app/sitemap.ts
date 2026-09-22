import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";
import { LOCALES, localizedPath } from "@/lib/i18n/locales";
import { absoluteUrl, hreflangAlternates } from "@/lib/seo";

export const revalidate = 3600;

const STATIC_PATHS: { path: string; priority: number; changeFrequency: "daily" | "weekly" | "monthly" }[] = [
  { path: "/", priority: 1, changeFrequency: "daily" },
  { path: "/menu", priority: 0.9, changeFrequency: "daily" },
  { path: "/delivery", priority: 0.7, changeFrequency: "monthly" },
  { path: "/about", priority: 0.6, changeFrequency: "monthly" },
  { path: "/contacts", priority: 0.6, changeFrequency: "monthly" },
  { path: "/age-policy", priority: 0.3, changeFrequency: "monthly" },
  { path: "/privacy", priority: 0.2, changeFrequency: "monthly" },
  { path: "/terms", priority: 0.2, changeFrequency: "monthly" },
  { path: "/cookies", priority: 0.2, changeFrequency: "monthly" },
];

/** Каждый адрес — на всех 4 языках, с hreflang-альтернативами (включая x-default) */
function entry(
  path: string,
  lastModified: Date,
  priority: number,
  changeFrequency: "daily" | "weekly" | "monthly"
): MetadataRoute.Sitemap {
  const languages = hreflangAlternates(path);
  return LOCALES.map((locale) => ({
    url: absoluteUrl(localizedPath(locale, path)),
    lastModified,
    changeFrequency,
    priority,
    alternates: { languages },
  }));
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  let categories: { slug: string; updatedAt: Date }[] = [];
  let products: { slug: string; updatedAt: Date }[] = [];
  try {
    [categories, products] = await Promise.all([
      prisma.category.findMany({
        where: { isActive: true, products: { some: { isActive: true } } },
        select: { slug: true, updatedAt: true },
      }),
      prisma.product.findMany({
        where: { isActive: true, category: { isActive: true } },
        select: { slug: true, updatedAt: true },
      }),
    ]);
  } catch {
    // без БД отдаём только статические страницы
  }
  const now = new Date();
  return [
    ...STATIC_PATHS.flatMap((p) => entry(p.path, now, p.priority, p.changeFrequency)),
    ...categories.flatMap((c) => entry(`/menu/group/${c.slug}`, c.updatedAt, 0.7, "weekly")),
    ...products.flatMap((p) => entry(`/menu/${p.slug}`, p.updatedAt, 0.8, "weekly")),
  ];
}
