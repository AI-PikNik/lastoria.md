import { getTranslations } from "next-intl/server";
import { buildLlmsTxt } from "@/lib/llms";
import { getCategories, getProductCards } from "@/lib/catalog";
import { getDeliveryCities } from "@/lib/delivery-data";
import { getPublicSettings } from "@/lib/settings";
import { formatMoney } from "@/lib/format";
import { getSiteUrl } from "@/lib/site-url";

// Пересобирается раз в час и сразу после правок в админке (revalidatePath)
export const revalidate = 3600;

export async function GET() {
  // Английская версия — самый «универсальный» язык для AI-ассистентов;
  // ссылки на все языковые версии перечислены внутри файла.
  const locale = "en" as const;
  const [settings, categories, products, cities, tMeta] = await Promise.all([
    getPublicSettings(locale),
    getCategories(locale),
    getProductCards(locale),
    getDeliveryCities(locale),
    getTranslations({ locale, namespace: "meta" }),
  ]);
  const money = (v: number) => formatMoney(v, locale);

  const body = buildLlmsTxt({
    siteUrl: getSiteUrl(),
    locale,
    name: settings.name,
    description: settings.seoDescription || tMeta("defaultDescription"),
    address: settings.address,
    phone: settings.phone,
    email: settings.email,
    hours: settings.hours,
    minOrder: money(settings.minOrderAmount),
    groups: categories.map((c) => ({
      name: c.name,
      slug: c.slug,
      ageRestricted: c.requiresAgeConfirm || c.kind === "ALCOHOL",
      products: products
        .filter((p) => p.categoryId === c.id)
        .map((p) => ({
          name: p.name,
          slug: p.slug,
          price: `${p.hasVariants ? "from " : ""}${money(p.price)}`,
          description: p.shortDescription,
        })),
    })),
    delivery: cities.map((city) => ({
      city: city.name,
      zones: city.zones.map((z) => ({
        name: z.name,
        fee: `${z.fee > 0 ? money(z.fee) : "free"}${z.freeFrom ? ` (free from ${money(z.freeFrom)})` : ""}`,
      })),
    })),
  });

  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=0, s-maxage=3600" },
  });
}
