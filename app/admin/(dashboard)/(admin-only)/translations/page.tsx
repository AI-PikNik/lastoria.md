import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { BASE_MESSAGES } from "@/lib/i18n/messages";
import { flattenMessages } from "@/lib/i18n/messages-utils";
import { LOCALES, type AppLocale } from "@/lib/i18n/locales";
import { missingInMap, missingLocales } from "@/lib/i18n/translate";
import { adminName } from "@/lib/admin-data";
import { MissingBadge } from "@/components/admin/localized-fields";
import { UiTranslationsTable } from "@/components/admin/ui-translations-table";

export const metadata = { title: "Переводы" };
export const dynamic = "force-dynamic";

export default async function AdminTranslationsPage() {
  const [overrideRows, products, categories, zones, promos] = await Promise.all([
    prisma.uiTranslation.findMany(),
    prisma.product.findMany({ include: { translations: true }, orderBy: { sortOrder: "asc" } }),
    prisma.category.findMany({ include: { translations: true }, orderBy: { sortOrder: "asc" } }),
    prisma.deliveryZone.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } }),
    prisma.promo.findMany({ where: { isActive: true } }),
  ]);

  const base = Object.fromEntries(LOCALES.map((l) => [l, flattenMessages(BASE_MESSAGES[l])])) as Record<AppLocale, Record<string, string>>;
  const overrides = Object.fromEntries(LOCALES.map((l) => [l, {} as Record<string, string>])) as Record<AppLocale, Record<string, string>>;
  for (const row of overrideRows) overrides[row.locale as AppLocale][row.key] = row.value;

  const content = [
    ...categories.map((c) => ({
      id: c.id,
      type: "Группа",
      name: adminName(c.translations, c.slug),
      href: "/admin/categories",
      missing: missingLocales(c.translations, "name"),
    })),
    ...products.map((p) => ({
      id: p.id,
      type: "Товар",
      name: adminName(p.translations, p.slug),
      href: `/admin/products/${p.id}`,
      missing: [...new Set([...missingLocales(p.translations, "name"), ...missingLocales(p.translations, "shortDescription")])],
    })),
    ...zones.map((z) => ({
      id: z.id,
      type: "Район доставки",
      name: (z.names as Record<string, string>).ru || (z.names as Record<string, string>).ro || "—",
      href: "/admin/delivery",
      missing: missingInMap(z.names),
    })),
    ...promos.map((p) => ({
      id: p.id,
      type: "Промо",
      name: p.name,
      href: `/admin/promos/${p.id}`,
      missing: missingInMap(p.publicNames),
    })),
  ].filter((row) => row.missing.length > 0);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl font-bold">Переводы</h1>
        <p className="text-sm text-muted-foreground">
          Сайт работает на 4 языках: румынский (основной), русский, английский, итальянский. Если перевода нет, покупатель
          видит румынский текст, а если нет и его — первый заполненный язык. Админка всегда на русском.
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Контент без перевода ({content.length})</h2>
        {content.length === 0 ? (
          <p className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">Все товары, группы, районы и промо переведены на 4 языка. 🎉</p>
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border bg-card">
            {content.map((row) => (
              <li key={`${row.type}-${row.id}`} className="flex flex-wrap items-center gap-3 px-4 py-2.5 text-sm">
                <span className="w-32 text-xs text-muted-foreground">{row.type}</span>
                <Link href={row.href} className="font-medium text-primary hover:underline">
                  {row.name}
                </Link>
                <span className="flex flex-wrap gap-1">
                  {row.missing.map((l) => (
                    <MissingBadge key={l} locale={l} />
                  ))}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold">Тексты интерфейса</h2>
          <p className="text-sm text-muted-foreground">
            Кнопки, подписи, тексты страниц «О нас», «Доставка», FAQ, письма клиентам. Изменение сохраняется, когда вы
            убираете курсор из поля. Жёлтые поля — перевода нет. Стрелка ↺ возвращает текст по умолчанию.
            Фигурные скобки вроде {"{min}"} не удаляйте — туда подставляются данные.
          </p>
        </div>
        <UiTranslationsTable base={base} overrides={overrides} />
      </section>
    </div>
  );
}
