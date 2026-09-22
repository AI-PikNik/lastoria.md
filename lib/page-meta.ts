import "server-only";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import type { AppLocale } from "@/lib/i18n/locales";
import { buildMetadata } from "@/lib/seo";
import { getPublicSettings } from "@/lib/settings";

/** Метаданные текстовой страницы из словаря pages.<key>.title / description */
export async function textPageMetadata(
  locale: AppLocale,
  key: "about" | "delivery" | "contacts" | "privacy" | "terms" | "agePolicy" | "cookies",
  path: string
): Promise<Metadata> {
  const [t, settings] = await Promise.all([getTranslations({ locale, namespace: `pages.${key}` }), getPublicSettings(locale)]);
  return buildMetadata({ locale, path, title: t("title"), description: t("description"), siteName: settings.name });
}
