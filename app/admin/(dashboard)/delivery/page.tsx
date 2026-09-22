import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/format";
import { toLocalized } from "@/lib/admin-forms";
import { DeliveryManager, type CityRow } from "@/components/admin/delivery-manager";

export const metadata = { title: "Доставка" };

export default async function AdminDeliveryPage() {
  const rows = await prisma.deliveryCity.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    include: { zones: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] } },
  });
  const cities: CityRow[] = rows.map((c) => ({
    id: c.id,
    slug: c.slug,
    names: toLocalized(c.names),
    isActive: c.isActive,
    zones: c.zones.map((z) => ({
      id: z.id,
      names: toLocalized(z.names),
      fee: toNumber(z.fee),
      freeFrom: z.freeFrom != null ? toNumber(z.freeFrom) : null,
      isActive: z.isActive,
    })),
  }));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-2xl font-bold">Доставка</h1>
        <p className="text-sm text-muted-foreground">
          Город → районы. У каждого района своя цена доставки. Клиент выбирает район при оформлении заказа;
          список и цены также видны на странице «Доставка» сайта. Порядок районов меняется перетаскиванием.
        </p>
      </div>
      <DeliveryManager cities={cities} />
    </div>
  );
}
