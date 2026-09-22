import { getCategoryOptions } from "@/lib/admin-data";
import { ProductForm } from "@/components/admin/product-form";
import { emptyProductForm } from "@/lib/admin-forms";

export const metadata = { title: "Новый товар" };

export default async function NewProductPage({ searchParams }: PageProps<"/admin/products/new">) {
  const params = await searchParams;
  const categories = await getCategoryOptions();
  const group = typeof params.group === "string" ? params.group : categories[0]?.id ?? "";
  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl font-bold">Новый товар</h1>
      <ProductForm initial={emptyProductForm(group)} categories={categories} />
    </div>
  );
}
