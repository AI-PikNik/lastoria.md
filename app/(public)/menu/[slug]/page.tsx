import Image from "next/image";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { fetchActivePromos, computeCatalogPricing } from "@/lib/pricing-data";
import { buildMetadata, breadcrumbJsonLd, productJsonLd } from "@/lib/seo";
import { PRODUCT_TYPE_LABELS } from "@/lib/constants";
import { JsonLd } from "@/components/seo/json-ld";
import { Badge } from "@/components/ui/badge";
import { Markdown } from "@/components/markdown";
import { ProductPurchasePanel } from "@/components/public/product-purchase-panel";
import { AlcoholGuard } from "@/components/age-gate/alcohol-guard";

async function getProduct(slug: string) {
  return prisma.product.findUnique({
    where: { slug },
    include: { category: true },
  });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProduct(slug);
  if (!product) return buildMetadata({ title: "Товар не найден", description: "", path: `/menu/${slug}`, noIndex: true });

  return buildMetadata({
    title: product.seoTitle || product.name,
    description: product.seoDescription || product.shortDescription || product.name,
    keywords: product.seoKeywords,
    path: `/menu/${product.slug}`,
    image: product.ogImageUrl || product.imageUrl,
    noIndex: !product.isActive,
  });
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const product = await getProduct(slug);
  if (!product || !product.isActive) notFound();

  const promos = await fetchActivePromos();
  const pricing = computeCatalogPricing([product], promos).get(product.id)!;
  const variants = Array.isArray(product.variants)
    ? (product.variants as unknown as { name: string; priceDelta: number }[])
    : [];
  const ingredients = Array.isArray(product.ingredients)
    ? (product.ingredients as unknown as string[])
    : [];
  const gallery = Array.isArray(product.galleryUrls)
    ? (product.galleryUrls as unknown as string[])
    : [];

  const content = (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Главная", path: "/" },
          { name: "Меню", path: "/menu" },
          { name: product.name, path: `/menu/${product.slug}` },
        ])}
      />
      <JsonLd data={productJsonLd(product)} />

      <div className="grid gap-8 md:grid-cols-2">
        <div>
          <div className="relative aspect-square overflow-hidden rounded-xl bg-muted">
            {product.imageUrl && (
              <Image
                src={product.imageUrl}
                alt={product.name}
                fill
                priority
                sizes="(max-width: 768px) 100vw, 50vw"
                className="object-cover"
              />
            )}
          </div>
          {gallery.length > 1 && (
            <div className="mt-3 grid grid-cols-4 gap-2">
              {gallery.slice(1).map((url) => (
                <div key={url} className="relative aspect-square overflow-hidden rounded-md bg-muted">
                  <Image src={url} alt={product.name} fill sizes="120px" className="object-cover" />
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <div className="mb-3 flex flex-wrap gap-2">
            <Badge variant="outline">{PRODUCT_TYPE_LABELS[product.type]}</Badge>
            {product.isFeatured && <Badge variant="accent">Хит</Badge>}
            {pricing.hasDiscount && <Badge variant="destructive">Акция</Badge>}
            {product.isAlcohol && <Badge variant="dark">18+</Badge>}
            {product.isSpicy && <Badge variant="secondary">Острое</Badge>}
            {product.isVegetarian && <Badge variant="secondary">Вегетарианское</Badge>}
          </div>

          <h1 className="font-display text-3xl font-bold">{product.name}</h1>
          {product.shortDescription && (
            <p className="mt-2 text-muted-foreground">{product.shortDescription}</p>
          )}

          <div className="mt-6">
            <ProductPurchasePanel
              productId={product.id}
              name={product.name}
              basePrice={pricing.price}
              isAlcohol={product.isAlcohol}
              variants={variants}
            />
          </div>

          {ingredients.length > 0 && (
            <div className="mt-6">
              <h2 className="font-display font-semibold">Состав</h2>
              <p className="mt-1 text-sm text-muted-foreground">{ingredients.join(", ")}</p>
            </div>
          )}

          {product.description && (
            <div className="mt-6">
              <h2 className="font-display font-semibold">Описание</h2>
              <Markdown content={product.description} />
            </div>
          )}
        </div>
      </div>
    </div>
  );

  if (product.isAlcohol) {
    return <AlcoholGuard>{content}</AlcoholGuard>;
  }

  return content;
}
