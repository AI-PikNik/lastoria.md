import "server-only";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { pickTranslation } from "@/lib/i18n/translate";
import { invalidateMessagesCache } from "@/lib/i18n/messages";

/** Название для админки: русский → румынский → любой заполненный язык */
export function adminName(rows: { locale: string; name: string }[], fallback = "—"): string {
  return pickTranslation(rows, "ru", ["name"] as const).values.name || fallback;
}

export async function getCategoryOptions() {
  const rows = await prisma.category.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    include: { translations: true },
  });
  return rows.map((c) => ({ id: c.id, name: adminName(c.translations, c.slug), kind: c.kind, isActive: c.isActive }));
}

export async function getProductOptions() {
  const rows = await prisma.product.findMany({
    orderBy: [{ category: { sortOrder: "asc" } }, { sortOrder: "asc" }],
    include: { translations: true },
  });
  return rows.map((p) => ({ id: p.id, name: adminName(p.translations, p.slug) }));
}

/**
 * Сбросить кэш публичного сайта после правок в админке: все страницы всех
 * языков, sitemap и /llms.txt пересоберутся при следующем запросе.
 */
export function revalidatePublicSite() {
  revalidatePath("/[locale]", "layout");
  revalidatePath("/sitemap.xml");
  revalidatePath("/llms.txt");
  revalidatePath("/manifest.webmanifest");
}

export function revalidateTranslations() {
  invalidateMessagesCache();
  revalidatePublicSite();
}
