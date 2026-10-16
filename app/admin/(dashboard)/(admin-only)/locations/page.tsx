import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { toLocalized } from "@/lib/admin-forms";
import { LocationsManager, type LocationRow } from "@/components/admin/locations-manager";

export const metadata = { title: "Заведения" };

export default async function AdminLocationsPage() {
  const rows = await prisma.location.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    include: { images: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] } },
  });
  const locations: LocationRow[] = rows.map((l) => ({
    id: l.id,
    name: toLocalized(l.name),
    description: toLocalized(l.description),
    hours: toLocalized(l.hours),
    address: l.address,
    phone: l.phone ?? "",
    mapUrl: l.mapUrl ?? "",
    isActive: l.isActive,
    images: l.images.map((img) => ({ id: img.id, url: img.url, caption: toLocalized(img.caption) })),
  }));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-2xl font-bold">Заведения</h1>
        <p className="text-sm text-muted-foreground">
          Точки La Storia на странице{" "}
          <Link href="/ru/about" target="_blank" className="text-primary underline-offset-4 hover:underline">
            «О нас»
          </Link>
          : текст о месте, адрес, телефон, часы и галерея. Когда откроется ещё одна точка — добавьте её здесь.
          Общий текст страницы — в «Тексты страниц → О нас»; телефон и адрес в шапке, подвале и для Google — в
          «Настройки → Ресторан».
        </p>
      </div>
      <LocationsManager locations={locations} />
    </div>
  );
}
