import "server-only";
import { cache } from "react";
import { prisma } from "@/lib/prisma";
import type { AppLocale } from "@/lib/i18n/locales";
import { localizeCities, type DeliveryCityView } from "@/lib/delivery";

/** Активные города и районы доставки (в порядке из админки). */
export const getDeliveryCities = cache(async (locale: AppLocale): Promise<DeliveryCityView[]> => {
  const rows = await prisma.deliveryCity.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    include: {
      zones: {
        where: { isActive: true },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      },
    },
  });
  return localizeCities(rows, locale);
});
