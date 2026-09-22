import { getCategoryOptions, getProductOptions } from "@/lib/admin-data";
import { PromoForm } from "@/components/admin/promo-form";

export default async function NewPromoPage() {
  const [products, categories] = await Promise.all([
    getProductOptions(),
    getCategoryOptions(),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-bold">Новое промо</h1>
      <PromoForm products={products} categories={categories} />
    </div>
  );
}
