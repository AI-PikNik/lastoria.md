import { pickLocalized } from "@/lib/i18n/translate";
import type { AppLocale } from "@/lib/i18n/locales";

/** Город доставки с районами — сериализуемый вид для публичной части. */
export interface DeliveryZoneView {
  id: string;
  name: string;
  fee: number;
  freeFrom: number | null;
}

export interface DeliveryCityView {
  id: string;
  slug: string;
  name: string;
  zones: DeliveryZoneView[];
}

interface CityRow {
  id: string;
  slug: string;
  names: unknown;
  zones: { id: string; names: unknown; fee: unknown; freeFrom: unknown }[];
}

export function localizeCities(rows: CityRow[], locale: AppLocale): DeliveryCityView[] {
  return rows
    .map((city) => ({
      id: city.id,
      slug: city.slug,
      name: pickLocalized(city.names, locale, city.slug),
      zones: city.zones.map((zone) => ({
        id: zone.id,
        name: pickLocalized(zone.names, locale, "—"),
        fee: Number(zone.fee ?? 0),
        freeFrom: zone.freeFrom != null ? Number(zone.freeFrom) : null,
      })),
    }))
    .filter((city) => city.zones.length > 0);
}

/**
 * Стоимость доставки в район. Если у района задан порог «бесплатно от»
 * и сумма заказа после скидок его достигла — доставка бесплатна.
 */
export function computeDeliveryFee(
  zone: { fee: number; freeFrom: number | null } | null | undefined,
  orderTotal: number
): number {
  if (!zone) return 0;
  if (zone.freeFrom != null && zone.freeFrom > 0 && orderTotal >= zone.freeFrom) return 0;
  return Math.max(zone.fee, 0);
}
