import "server-only";
import { getTranslations } from "next-intl/server";
import { formatMoney } from "@/lib/format";
import type { AppLocale } from "@/lib/i18n/locales";
import type { PublicSettings } from "@/lib/settings";

const FAQ_KEYS = ["q1", "q2", "q3", "q4", "q5", "q6", "q7"] as const;

/** FAQ на языке страницы; ответы подставляют реальные данные из настроек */
export async function getFaqItems(locale: AppLocale, settings: PublicSettings) {
  const t = await getTranslations({ locale, namespace: "pages.faq" });
  const values = {
    min: formatMoney(settings.minOrderAmount, locale),
    address: settings.address,
    hours: settings.hours || "—",
  };
  return FAQ_KEYS.map((key) => ({ q: t(`${key}.q`), a: t(`${key}.a`, values) }));
}
