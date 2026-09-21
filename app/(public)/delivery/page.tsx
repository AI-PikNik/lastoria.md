import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo";
import { StaticPage } from "@/components/public/static-page";
import { getSettings } from "@/lib/settings";
import { toNumber } from "@/lib/format";

export const metadata: Metadata = buildMetadata({
  title: "Доставка и оплата",
  description: "Условия доставки, зоны, минимальная сумма заказа и способы оплаты в La Storia.",
  path: "/delivery",
});

export default async function DeliveryPage() {
  const settings = await getSettings();
  const zones = Array.isArray(settings.deliveryZones)
    ? (settings.deliveryZones as unknown as { name: string; fee: number }[])
    : [];

  return (
    <StaticPage title="Доставка и оплата">
      <p>
        Минимальная сумма заказа: <strong>{toNumber(settings.minOrderAmount)} MDL</strong>.
        Часы работы: {settings.workingHours}.
      </p>
      {zones.length > 0 && (
        <div>
          <h2 className="font-display text-lg font-semibold">Зоны доставки</h2>
          <ul className="mt-2 space-y-1">
            {zones.map((zone) => (
              <li key={zone.name}>
                {zone.name} — {zone.fee} MDL
              </li>
            ))}
          </ul>
        </div>
      )}
      <div>
        <h2 className="font-display text-lg font-semibold">Способы оплаты</h2>
        <p>Наличными курьеру/на кассе или картой курьеру при получении. Онлайн-оплата картой не поддерживается.</p>
      </div>
      <div>
        <h2 className="font-display text-lg font-semibold">Самовывоз</h2>
        <p>Заберите заказ по адресу: {settings.restaurantAddress}.</p>
      </div>
    </StaticPage>
  );
}
