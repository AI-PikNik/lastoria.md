import Link from "next/link";
import { getSettings } from "@/lib/settings";
import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/format";
import { SettingsForm } from "@/components/admin/settings-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function AdminSettingsPage() {
  const [settings, products] = await Promise.all([
    getSettings(),
    prisma.product.findMany({
      where: { isActive: true },
      select: { id: true, name: true, slug: true, seoTitle: true, seoDescription: true },
    }),
  ]);

  const zones = Array.isArray(settings.deliveryZones)
    ? (settings.deliveryZones as unknown as { name: string; fee: number }[])
    : [];

  const missingSeo = products.filter((p) => !p.seoTitle || !p.seoDescription);

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-bold">Настройки</h1>

      <SettingsForm
        settings={{
          restaurantName: settings.restaurantName,
          restaurantPhone: settings.restaurantPhone,
          restaurantAddress: settings.restaurantAddress,
          restaurantEmail: settings.restaurantEmail ?? "",
          workingHours: settings.workingHours,
          minOrderAmount: toNumber(settings.minOrderAmount),
          seoDefaultTitle: settings.seoDefaultTitle,
          seoDefaultDescription: settings.seoDefaultDescription,
          telegramChatId: settings.telegramChatId ?? "",
          emailSenderAddress: settings.emailSenderAddress ?? "",
          deliveryZones: zones,
        }}
      />

      <Card>
        <CardHeader>
          <CardTitle>SEO-чеклист товаров</CardTitle>
        </CardHeader>
        <CardContent>
          {missingSeo.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              У всех активных товаров заполнены SEO title и description.
            </p>
          ) : (
            <ul className="space-y-2 text-sm">
              {missingSeo.map((p) => (
                <li key={p.id} className="flex items-center justify-between">
                  <span>{p.name}</span>
                  <div className="flex items-center gap-2">
                    {!p.seoTitle && <span className="text-xs text-destructive">нет title</span>}
                    {!p.seoDescription && (
                      <span className="text-xs text-destructive">нет description</span>
                    )}
                    <Link href={`/admin/products/${p.id}`} className="text-primary hover:underline">
                      Исправить
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
