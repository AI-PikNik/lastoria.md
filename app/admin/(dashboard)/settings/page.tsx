import Link from "next/link";
import { getSettings } from "@/lib/settings";
import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/format";
import { LOCALES, LOCALE_LABELS } from "@/lib/i18n/locales";
import { SettingsForm } from "@/components/admin/settings-form";
import { toLocalized } from "@/lib/admin-forms";

export const metadata = { title: "Настройки" };

export default async function AdminSettingsPage() {
  const [settings, products] = await Promise.all([
    getSettings(),
    prisma.product.findMany({ where: { isActive: true }, select: { id: true, translations: true } }),
  ]);

  // Сводка SEO по языкам: у скольких товаров нет названия / SEO-заголовка / SEO-описания
  const seoSummary = LOCALES.map((locale) => {
    const rows = products.map((p) => p.translations.find((t) => t.locale === locale));
    return {
      locale,
      noName: rows.filter((t) => !t?.name).length,
      noTitle: rows.filter((t) => !t?.seoTitle).length,
      noDescription: rows.filter((t) => !t?.seoDescription).length,
    };
  });

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-bold">Настройки</h1>

      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="text-lg font-semibold">SEO-проверка по языкам</h2>
        <p className="text-sm text-muted-foreground">Активных товаров: {products.length}.</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {seoSummary.map((s) => (
            <div key={s.locale} className="rounded-lg border border-border p-3 text-sm">
              <p className="font-semibold">{LOCALE_LABELS[s.locale]}</p>
              <p className={s.noName ? "text-amber-700" : "text-muted-foreground"}>без названия: {s.noName}</p>
              <p className={s.noTitle ? "text-amber-700" : "text-muted-foreground"}>без SEO-заголовка: {s.noTitle}</p>
              <p className={s.noDescription ? "text-amber-700" : "text-muted-foreground"}>без SEO-описания: {s.noDescription}</p>
            </div>
          ))}
        </div>
        <p className="mt-3 text-sm">
          <Link href="/admin/translations" className="text-primary hover:underline">
            Открыть страницу переводов →
          </Link>{" "}
          · Проверка: <a href="/sitemap.xml" target="_blank" className="text-primary hover:underline">sitemap.xml</a> ·{" "}
          <a href="/llms.txt" target="_blank" className="text-primary hover:underline">llms.txt</a> ·{" "}
          <a href="/robots.txt" target="_blank" className="text-primary hover:underline">robots.txt</a>
        </p>
      </section>

      <SettingsForm
        initial={{
          restaurantName: settings.restaurantName,
          restaurantPhone: settings.restaurantPhone,
          restaurantAddress: settings.restaurantAddress,
          restaurantEmail: settings.restaurantEmail ?? "",
          workingHours: toLocalized(settings.workingHours),
          minOrderAmount: String(toNumber(settings.minOrderAmount)),
          seoTitles: toLocalized(settings.seoTitles),
          seoDescriptions: toLocalized(settings.seoDescriptions),
          shortAnswers: toLocalized(settings.shortAnswers),
          telegramChatId: settings.telegramChatId ?? "",
          emailSenderAddress: settings.emailSenderAddress ?? "",
          logoUrl: settings.logoUrl,
          faviconUrl: settings.faviconUrl,
          heroImageUrl: settings.heroImageUrl,
          geoLat: settings.geoLat != null ? String(settings.geoLat) : "",
          geoLng: settings.geoLng != null ? String(settings.geoLng) : "",
          cookieBannerEnabled: settings.cookieBannerEnabled,
          analyticsId: settings.analyticsId ?? "",
        }}
      />
    </div>
  );
}
