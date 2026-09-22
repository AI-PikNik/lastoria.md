export const LOCALES = ["ro", "ru", "en", "it"] as const;
export type AppLocale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: AppLocale = "ro";

export const LOCALE_LABELS: Record<AppLocale, string> = {
  ro: "Română",
  ru: "Русский",
  en: "English",
  it: "Italiano",
};

export const LOCALE_SHORT: Record<AppLocale, string> = {
  ro: "RO",
  ru: "RU",
  en: "EN",
  it: "IT",
};

/** Open Graph / hreflang / Intl-коды */
export const LOCALE_REGION: Record<AppLocale, string> = {
  ro: "ro_RO",
  ru: "ru_RU",
  en: "en_US",
  it: "it_IT",
};

export const LOCALE_INTL: Record<AppLocale, string> = {
  ro: "ro-RO",
  ru: "ru-RU",
  en: "en-US",
  it: "it-IT",
};

export function isLocale(value: unknown): value is AppLocale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

/** Путь с учётом префикса локали: ro — без префикса, остальные — /ru, /en, /it */
export function localizedPath(locale: AppLocale, path: string): string {
  const clean = path === "/" ? "" : path.startsWith("/") ? path : `/${path}`;
  if (locale === DEFAULT_LOCALE) return clean || "/";
  return `/${locale}${clean}`;
}
