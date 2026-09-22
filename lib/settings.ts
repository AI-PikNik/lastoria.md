import "server-only";
import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/format";
import { pickLocalized } from "@/lib/i18n/translate";
import type { AppLocale } from "@/lib/i18n/locales";
import type { Settings } from "@/lib/generated/prisma/client";

const DEFAULT_SETTINGS: Omit<Settings, "updatedAt"> = {
  id: "main",
  restaurantName: "La Storia",
  restaurantPhone: "+373 00 000 000",
  restaurantAddress: "Chișinău, Republica Moldova",
  restaurantEmail: null,
  workingHours: {},
  minOrderAmount: 0 as unknown as Settings["minOrderAmount"],
  seoTitles: {},
  seoDescriptions: {},
  shortAnswers: {},
  telegramChatId: null,
  emailSenderAddress: null,
  logoUrl: null,
  faviconUrl: null,
  heroImageUrl: null,
  geoLat: null,
  geoLng: null,
  cookieBannerEnabled: true,
  analyticsId: null,
};

/** Сырые настройки из БД (один запрос на рендер благодаря cache). */
export const getSettings = cache(async (): Promise<Settings> => {
  try {
    const settings = await prisma.settings.findUnique({ where: { id: "main" } });
    if (settings) return settings;
  } catch {
    // БД недоступна (например, во время сборки без базы) — берём значения по умолчанию
  }
  return { ...DEFAULT_SETTINGS, updatedAt: new Date() };
});

/** Настройки для публичной части: всё сериализуемо и уже на нужном языке. */
export interface PublicSettings {
  name: string;
  phone: string;
  address: string;
  email: string | null;
  hours: string;
  minOrderAmount: number;
  seoTitle: string;
  seoDescription: string;
  shortAnswer: string;
  logoUrl: string | null;
  faviconUrl: string | null;
  heroImageUrl: string | null;
  geo: { lat: number; lng: number } | null;
  cookieBannerEnabled: boolean;
  analyticsId: string | null;
}

export const DEFAULT_HERO_IMAGE = "/brand/poster.jpg";

export const getPublicSettings = cache(async (locale: AppLocale): Promise<PublicSettings> => {
  const s = await getSettings();
  return {
    name: s.restaurantName,
    phone: s.restaurantPhone,
    address: s.restaurantAddress,
    email: s.restaurantEmail,
    hours: pickLocalized(s.workingHours, locale),
    minOrderAmount: toNumber(s.minOrderAmount),
    seoTitle: pickLocalized(s.seoTitles, locale),
    seoDescription: pickLocalized(s.seoDescriptions, locale),
    shortAnswer: pickLocalized(s.shortAnswers, locale),
    logoUrl: s.logoUrl,
    faviconUrl: s.faviconUrl,
    heroImageUrl: s.heroImageUrl,
    geo: s.geoLat != null && s.geoLng != null ? { lat: s.geoLat, lng: s.geoLng } : null,
    cookieBannerEnabled: s.cookieBannerEnabled,
    analyticsId: s.analyticsId,
  };
});

/** tel:-ссылка из номера в свободном формате */
export function telHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}
