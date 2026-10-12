import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/format";
import { LOCALES, type AppLocale } from "@/lib/i18n/locales";
import { parseVariants } from "@/lib/variants";
import { adminName, getCategoryOptions } from "@/lib/admin-data";
import { ProductForm, type ProductFormValues } from "@/components/admin/product-form";
import { toLocalized } from "@/lib/admin-forms";

export const metadata = { title: "Редактирование товара" };

export default async function EditProductPage({ params }: PageProps<"/admin/products/[id]">) {
  const { id } = await params;
  const [product, categories] = await Promise.all([
    prisma.product.findUnique({ where: { id }, include: { translations: true } }),
    getCategoryOptions(),
  ]);
  if (!product) notFound();

  const byLocale = new Map(product.translations.map((t) => [t.locale as AppLocale, t]));
  const gallery = Array.isArray(product.galleryUrls) ? (product.galleryUrls as string[]) : [];
  const images = [product.imageUrl, ...gallery].filter((u, i, all): u is string => !!u && all.indexOf(u) === i);

  const initial: ProductFormValues = {
    slug: product.slug,
    categoryId: product.categoryId,
    price: String(toNumber(product.price)),
    oldPrice: product.oldPrice ? String(toNumber(product.oldPrice)) : "",
    isAlcohol: product.isAlcohol,
    isVegetarian: product.isVegetarian,
    isSpicy: product.isSpicy,
    isActive: product.isActive,
    isFeatured: product.isFeatured,
    sku: product.sku ?? "",
    sortOrder: String(product.sortOrder),
    stock: product.stock != null ? String(product.stock) : "",
    images,
    ogImageUrl: product.ogImageUrl,
    variants: parseVariants(product.variants).map((v) => ({
      key: v.key,
      priceDelta: String(v.priceDelta),
      names: toLocalized(v.names),
    })),
    translations: Object.fromEntries(
      LOCALES.map((l) => {
        const t = byLocale.get(l);
        return [
          l,
          {
            name: t?.name ?? "",
            shortDescription: t?.shortDescription ?? "",
            description: t?.description ?? "",
            ingredientsText: t?.ingredientsText ?? "",
            seoTitle: t?.seoTitle ?? "",
            seoDescription: t?.seoDescription ?? "",
            seoKeywords: t?.seoKeywords ?? "",
            shortAnswer: t?.shortAnswer ?? "",
            imageAlt: t?.imageAlt ?? "",
          },
        ];
      })
    ) as ProductFormValues["translations"],
  };

  return (
    <div className="space-y-4">
      <Link href="/admin/products" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Все товары
      </Link>
      <h1 className="font-display text-2xl font-bold">{adminName(product.translations, product.slug)}</h1>
      {/* key: после сохранения форма получает свежие данные из БД */}
      <ProductForm key={product.updatedAt.toISOString()} productId={product.id} initial={initial} categories={categories} />
    </div>
  );
}
