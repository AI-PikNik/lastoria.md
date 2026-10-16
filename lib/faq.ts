import "server-only";
import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { formatMoney } from "@/lib/format";
import { pickLocalized } from "@/lib/i18n/translate";
import type { AppLocale } from "@/lib/i18n/locales";
import type { PublicSettings } from "@/lib/settings";

const loadFaq = cache(async () => {
  try {
    return await prisma.faqItem.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });
  } catch {
    // БД недоступна (сборка без базы) — без вопросов
    return [];
  }
});

/** Подстановка {min}, {address}, {hours} из настроек */
export function fillFaqPlaceholders(text: string, values: Record<string, string>): string {
  return text.replace(/\{(min|address|hours)\}/g, (_, key: string) => values[key] ?? "");
}

/** Вопросы-ответы на языке страницы (Админка → Вопросы и ответы); скрытые не показываются */
export async function getFaqItems(locale: AppLocale, settings: PublicSettings) {
  const values = {
    min: formatMoney(settings.minOrderAmount, locale),
    address: settings.address,
    hours: settings.hours || "—",
  };
  return (await loadFaq())
    .map((item) => ({
      q: fillFaqPlaceholders(pickLocalized(item.question, locale), values),
      a: fillFaqPlaceholders(pickLocalized(item.answer, locale), values),
    }))
    .filter((item) => item.q && item.a);
}
