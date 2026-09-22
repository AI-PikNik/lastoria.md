import { DEFAULT_LOCALE, LOCALES, type AppLocale } from "./locales";

type Localized = Partial<Record<AppLocale, string | null | undefined>>;

function filled(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * Порядок поиска значения: текущий язык → румынский (по умолчанию) → первый
 * непустой из остальных.
 */
export function fallbackOrder(locale: AppLocale): AppLocale[] {
  const rest = LOCALES.filter((l) => l !== locale && l !== DEFAULT_LOCALE);
  return locale === DEFAULT_LOCALE ? [locale, ...rest] : [locale, DEFAULT_LOCALE, ...rest];
}

/** Значение из JSON-карты { ro, ru, en, it } с fallback. */
export function pickLocalized(map: unknown, locale: AppLocale, fallback = ""): string {
  if (!map || typeof map !== "object") return fallback;
  const record = map as Localized;
  for (const l of fallbackOrder(locale)) {
    const value = record[l];
    if (filled(value)) return value;
  }
  return fallback;
}

export interface TranslationRow {
  locale: AppLocale | string;
}

/**
 * Собирает переводимые поля из строк-переводов (CategoryTranslation,
 * ProductTranslation) с fallback по каждому полю отдельно.
 * `missing` — true, если в текущем языке нет основного поля (name).
 */
export function pickTranslation<T extends TranslationRow, K extends keyof T>(
  rows: T[],
  locale: AppLocale,
  fields: readonly K[]
): { values: { [P in K]: string }; missing: boolean } {
  const byLocale = new Map(rows.map((row) => [row.locale as AppLocale, row]));
  const values = {} as { [P in K]: string };
  for (const field of fields) {
    let result = "";
    for (const l of fallbackOrder(locale)) {
      const value = byLocale.get(l)?.[field];
      if (filled(value)) {
        result = value;
        break;
      }
    }
    values[field] = result;
  }
  const own = byLocale.get(locale) as Record<string, unknown> | undefined;
  const primary = fields[0] as string;
  return { values, missing: !own || !filled(own[primary]) };
}

/** Какие языки не заполнены по указанному полю (для жёлтых бейджей в админке). */
export function missingLocales<T extends TranslationRow>(rows: T[], field: keyof T): AppLocale[] {
  const byLocale = new Map(rows.map((row) => [row.locale as AppLocale, row]));
  return LOCALES.filter((l) => !filled(byLocale.get(l)?.[field]));
}

export function missingInMap(map: unknown): AppLocale[] {
  const record = (map && typeof map === "object" ? map : {}) as Localized;
  return LOCALES.filter((l) => !filled(record[l]));
}
