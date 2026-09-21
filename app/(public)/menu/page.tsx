import Link from "next/link";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { cn } from "@/lib/utils";
import { getSettings } from "@/lib/settings";
import { fetchActivePromos, computeCatalogPricing } from "@/lib/pricing-data";
import { buildMetadata, breadcrumbJsonLd, menuJsonLd } from "@/lib/seo";
import { JsonLd } from "@/components/seo/json-ld";
import { ProductCard, type ProductCardData } from "@/components/public/product-card";
import { MenuFilters } from "@/components/public/menu-filters";
import type { Prisma } from "@/lib/generated/prisma/client";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettings();
  return buildMetadata({
    title: "Меню",
    description: `Меню La Storia: пицца, напитки, алкоголь и снеки. ${settings.seoDefaultDescription}`,
    path: "/menu",
  });
}

interface MenuSearchParams {
  category?: string;
  spicy?: string;
  veg?: string;
  alcohol?: string;
  promo?: string;
  priceMin?: string;
  priceMax?: string;
}

export default async function MenuPage({
  searchParams,
}: {
  searchParams: Promise<MenuSearchParams>;
}) {
  const params = await searchParams;

  const categories = await prisma.category.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
  });

  const activeCategory = categories.find((c) => c.slug === params.category);

  const where: Prisma.ProductWhereInput = { isActive: true };
  if (activeCategory) where.categoryId = activeCategory.id;
  if (params.spicy === "1") where.isSpicy = true;
  if (params.veg === "1") where.isVegetarian = true;
  if (params.alcohol === "1") where.isAlcohol = true;

  const priceMin = params.priceMin ? Number(params.priceMin) : undefined;
  const priceMax = params.priceMax ? Number(params.priceMax) : undefined;
  if (priceMin != null || priceMax != null) {
    where.price = {
      ...(priceMin != null ? { gte: priceMin } : {}),
      ...(priceMax != null ? { lte: priceMax } : {}),
    };
  }

  const [products, promos] = await Promise.all([
    prisma.product.findMany({ where, orderBy: { sortOrder: "asc" } }),
    fetchActivePromos(),
  ]);

  const pricingMap = computeCatalogPricing(products, promos);
  let cards: ProductCardData[] = products.map((p) => {
    const pricing = pricingMap.get(p.id)!;
    return {
      id: p.id,
      slug: p.slug,
      name: p.name,
      shortDescription: p.shortDescription,
      imageUrl: p.imageUrl,
      isAlcohol: p.isAlcohol,
      isVegetarian: p.isVegetarian,
      isSpicy: p.isSpicy,
      isFeatured: p.isFeatured,
      price: pricing.price,
      oldPrice: pricing.oldPrice,
      hasDiscount: pricing.hasDiscount,
    };
  });

  if (params.promo === "1") {
    cards = cards.filter((c) => c.hasDiscount);
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Главная", path: "/" },
          { name: "Меню", path: "/menu" },
        ])}
      />
      <JsonLd
        data={menuJsonLd(categories.map((c) => ({ name: c.name, url: `/menu?category=${c.slug}` })))}
      />

      <h1 className="font-display text-3xl font-bold">Меню</h1>

      <div
        role="tablist"
        aria-label="Категории меню"
        className="mt-6 flex gap-2 overflow-x-auto pb-2"
      >
        <CategoryTab href="/menu" active={!activeCategory} label="Всё меню" />
        {categories.map((category) => (
          <CategoryTab
            key={category.id}
            href={`/menu?category=${category.slug}`}
            active={activeCategory?.id === category.id}
            label={category.name}
          />
        ))}
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-[240px_1fr]">
        <aside>
          <MenuFilters />
        </aside>
        <section>
          {cards.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border p-8 text-center text-muted-foreground">
              По заданным фильтрам ничего не найдено. Попробуйте изменить условия.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              {cards.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function CategoryTab({ href, active, label }: { href: string; active: boolean; label: string }) {
  return (
    <Link
      href={href}
      role="tab"
      aria-selected={active}
      className={cn(
        "whitespace-nowrap rounded-full border px-4 py-2 text-sm font-medium transition-colors",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-card text-foreground hover:bg-secondary"
      )}
    >
      {label}
    </Link>
  );
}
