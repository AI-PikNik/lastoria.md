import { prisma } from "@/lib/prisma";
import type { Settings } from "@/lib/generated/prisma/client";

const DEFAULT_SETTINGS: Omit<Settings, "updatedAt"> = {
  id: "main",
  restaurantName: "La Storia",
  restaurantPhone: "+373 00 000 000",
  restaurantAddress: "Chișinău, Republica Moldova",
  restaurantEmail: null,
  workingHours: "10:00–22:00",
  minOrderAmount: 0 as unknown as Settings["minOrderAmount"],
  deliveryZones: [],
  seoDefaultTitle: "La Storia — настоящая пиццерия в Молдове",
  seoDefaultDescription:
    "Закажите пиццу, напитки и готовую еду в La Storia. Доставка и самовывоз по Кишинёву.",
  telegramChatId: null,
  emailSenderAddress: null,
};

export async function getSettings(): Promise<Settings> {
  const settings = await prisma.settings.findUnique({ where: { id: "main" } });
  if (settings) return settings;
  return { ...DEFAULT_SETTINGS, updatedAt: new Date() };
}
