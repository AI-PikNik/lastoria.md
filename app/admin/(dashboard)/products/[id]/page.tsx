import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/format";
import { ProductForm } from "@/components/admin/product-form";

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [product, categories] = await Promise.all([
    prisma.product.findUnique({ where: { id } }),
    prisma.category.findMany({ orderBy: { sortOrder: "asc" } }),
  ]);

  if (!product) notFound();

  const variants = Array.isArray(product.variants)
    ? (product.variants as unknown as { name: string; priceDelta: number }[])
    : [];
  const ingredients = Array.isArray(product.ingredients)
    ? (product.ingredients as unknown as string[])
    : [];
  const galleryUrls = Array.isArray(product.galleryUrls)
    ? (product.galleryUrls as unknown as string[])
    : [];

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-bold">Редактирование товара</h1>
      <ProductForm
        categories={categories}
        product={{
          id: product.id,
          name: product.name,
          slug: product.slug,
          description: product.description,
          shortDescription: product.shortDescription,
          categoryId: product.categoryId,
          type: product.type,
          price: toNumber(product.price),
          oldPrice: product.oldPrice ? toNumber(product.oldPrice) : null,
          isAlcohol: product.isAlcohol,
          isVegetarian: product.isVegetarian,
          isSpicy: product.isSpicy,
          isActive: product.isActive,
          isFeatured: product.isFeatured,
          sku: product.sku,
          sortOrder: product.sortOrder,
          stock: product.stock,
          imageUrl: product.imageUrl,
          galleryUrls,
          ingredients,
          variants,
          seoTitle: product.seoTitle,
          seoDescription: product.seoDescription,
          seoKeywords: product.seoKeywords,
        }}
      />
    </div>
  );
}
