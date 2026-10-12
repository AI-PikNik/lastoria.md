import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCategoryOptions, getProductOptions } from "@/lib/admin-data";
import { toNumber } from "@/lib/format";
import { PromoForm } from "@/components/admin/promo-form";

export default async function EditPromoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [promo, products, categories] = await Promise.all([
    prisma.promo.findUnique({ where: { id } }),
    getProductOptions(),
    getCategoryOptions(),
  ]);

  if (!promo) notFound();

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-bold">Редактирование промо</h1>
      <PromoForm
        products={products}
        categories={categories}
        promo={{
          id: promo.id,
          name: promo.name,
          publicNames: promo.publicNames,
          code: promo.code,
          type: promo.type,
          value: toNumber(promo.value),
          scope: promo.scope,
          targetIds: Array.isArray(promo.targetIds) ? (promo.targetIds as unknown as string[]) : [],
          minOrderAmount: promo.minOrderAmount ? toNumber(promo.minOrderAmount) : null,
          startsAt: promo.startsAt.toISOString(),
          endsAt: promo.endsAt.toISOString(),
          isActive: promo.isActive,
          stackable: promo.stackable,
        }}
      />
    </div>
  );
}
