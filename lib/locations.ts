import "server-only";
import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { pickLocalized } from "@/lib/i18n/translate";
import type { AppLocale } from "@/lib/i18n/locales";

export interface PublicLocation {
  id: string;
  name: string;
  description: string;
  address: string;
  phone: string | null;
  hours: string;
  mapUrl: string | null;
  images: { id: string; url: string; caption: string }[];
}

const loadLocations = cache(async () => {
  try {
    return await prisma.location.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      include: { images: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] } },
    });
  } catch {
    return [];
  }
});

/** Заведения для страницы «О нас» (Админка → Заведения) */
export async function getPublicLocations(locale: AppLocale): Promise<PublicLocation[]> {
  return (await loadLocations()).map((l) => ({
    id: l.id,
    name: pickLocalized(l.name, locale),
    description: pickLocalized(l.description, locale),
    address: l.address,
    phone: l.phone,
    hours: pickLocalized(l.hours, locale),
    mapUrl: l.mapUrl,
    images: l.images.map((img) => ({ id: img.id, url: img.url, caption: pickLocalized(img.caption, locale) })),
  }));
}
