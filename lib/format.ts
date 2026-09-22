import { CURRENCY } from "@/lib/constants";
import { LOCALE_INTL, type AppLocale } from "@/lib/i18n/locales";

export function toNumber(value: unknown): number {
  if (typeof value === "number") return value;
  if (value && typeof value === "object" && "toNumber" in value) {
    return (value as { toNumber: () => number }).toNumber();
  }
  return Number(value ?? 0);
}

/** 125 → «125 MDL», 125.5 → «125,50 MDL» (формат чисел по языку) */
export function formatMoney(value: unknown, locale: AppLocale | "admin" = "ro"): string {
  const amount = toNumber(value);
  const intl = locale === "admin" ? "ru-RU" : LOCALE_INTL[locale];
  const hasCents = Math.round(amount * 100) % 100 !== 0;
  const number = new Intl.NumberFormat(intl, {
    minimumFractionDigits: hasCents ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(amount);
  return `${number} ${CURRENCY}`;
}

export function formatDate(value: Date | string, locale: AppLocale | "admin" = "admin"): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat(locale === "admin" ? "ru-RU" : LOCALE_INTL[locale], {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Europe/Chisinau",
  }).format(date);
}

export function formatDateTime(value: Date | string, locale: AppLocale | "admin" = "admin"): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat(locale === "admin" ? "ru-RU" : LOCALE_INTL[locale], {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Chisinau",
  }).format(date);
}
