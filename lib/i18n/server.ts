import "server-only";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { isLocale, type AppLocale } from "./locales";

/**
 * Достаёт язык из params страницы/лейаута, отдаёт 404 для неизвестного
 * префикса и включает статический рендер next-intl для этого языка.
 */
export async function resolveLocaleParam(params: Promise<{ locale: string }>): Promise<AppLocale> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);
  return locale;
}
