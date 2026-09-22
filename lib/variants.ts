import { pickLocalized } from "@/lib/i18n/translate";
import type { AppLocale } from "@/lib/i18n/locales";

/** Вариант товара (размер, объём): ключ стабилен, названия — на 4 языках. */
export interface VariantDef {
  key: string;
  priceDelta: number;
  names: Partial<Record<AppLocale, string>>;
}

export interface LocalizedVariant {
  key: string;
  name: string;
  priceDelta: number;
}

export function parseVariants(value: unknown): VariantDef[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((v): v is Record<string, unknown> => !!v && typeof v === "object")
    .map((v, index) => ({
      key: typeof v.key === "string" && v.key ? v.key : `v${index + 1}`,
      priceDelta: Number(v.priceDelta ?? 0) || 0,
      names:
        v.names && typeof v.names === "object"
          ? (v.names as Partial<Record<AppLocale, string>>)
          : typeof v.name === "string"
            ? { ro: v.name }
            : {},
    }));
}

export function localizeVariants(value: unknown, locale: AppLocale): LocalizedVariant[] {
  return parseVariants(value).map((v) => ({
    key: v.key,
    priceDelta: v.priceDelta,
    name: pickLocalized(v.names, locale, v.key),
  }));
}
