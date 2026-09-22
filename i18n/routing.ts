import { defineRouting } from "next-intl/routing";
import { DEFAULT_LOCALE, LOCALES } from "@/lib/i18n/locales";

export const routing = defineRouting({
  locales: LOCALES,
  defaultLocale: DEFAULT_LOCALE,
  // ro — без префикса (/menu), остальные — /ru/menu, /en/menu, /it/menu
  localePrefix: "as-needed",
  // Язык не угадываем по заголовкам браузера: `/` всегда румынская версия
  // (важно для SEO). Выбор пользователя учитывается через cookie в proxy.ts.
  localeDetection: false,
  localeCookie: { name: "NEXT_LOCALE", maxAge: 60 * 60 * 24 * 365 },
  // hreflang выводим в <head> с абсолютными URL из NEXT_PUBLIC_SITE_URL
  alternateLinks: false,
});
