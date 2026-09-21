import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { fetchActivePromos, computeCatalogPricing } from "@/lib/pricing-data";
import { buildMetadata, organizationJsonLd, restaurantJsonLd } from "@/lib/seo";
import { JsonLd } from "@/components/seo/json-ld";
import { ProductCard, type ProductCardData } from "@/components/public/product-card";
import { Button } from "@/components/ui/button";
import { toNumber } from "@/lib/format";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettings();
  return buildMetadata({
    title: settings.seoDefaultTitle,
    description: settings.seoDefaultDescription,
    path: "/",
  });
}

export default async function HomePage() {
  const [settings, featured, promos] = await Promise.all([
    getSettings(),
    prisma.product.findMany({
      where: { isActive: true, isFeatured: true },
      take: 8,
      orderBy: { sortOrder: "asc" },
    }),
    fetchActivePromos(),
  ]);

  const pricing = computeCatalogPricing(featured, promos);
  const products: ProductCardData[] = featured.map((p) => {
    const price = pricing.get(p.id)!;
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
      price: price.price,
      oldPrice: price.oldPrice,
      hasDiscount: price.hasDiscount,
    };
  });

  return (
    <>
      <JsonLd data={organizationJsonLd(settings)} />
      <JsonLd data={restaurantJsonLd(settings)} />

      <section className="bg-gradient-to-b from-secondary/60 to-background">
        <div className="mx-auto grid max-w-6xl items-center gap-8 px-4 py-16 md:grid-cols-2">
          <div>
            <h1 className="font-display text-4xl font-bold leading-tight text-foreground md:text-5xl">
              Настоящая пицца из дровяной печи в сердце Кишинёва
            </h1>
            <p className="mt-4 text-lg text-muted-foreground">
              Свежее тесто, отборные ингредиенты и быстрая доставка. Закажите онлайн —
              оператор перезвонит и подтвердит заказ.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link href="/menu">Смотреть меню</Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/delivery">Условия доставки</Link>
              </Button>
            </div>
            <p className="mt-6 text-sm text-muted-foreground">
              {settings.workingHours} · {settings.restaurantAddress}
            </p>
          </div>
          <div className="relative aspect-square overflow-hidden rounded-2xl shadow-lg">
            {featured[0]?.imageUrl && (
              <Image
                src={featured[0].imageUrl}
                alt={featured[0].name}
                fill
                priority
                sizes="(max-width: 768px) 100vw, 50vw"
                className="object-cover"
              />
            )}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16">
        <div className="mb-8 flex items-end justify-between">
          <h2 className="font-display text-2xl font-semibold">Хиты продаж</h2>
          <Link href="/menu" className="text-sm font-medium text-primary hover:underline">
            Всё меню →
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </section>

      <section className="bg-secondary/50 py-16">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 md:grid-cols-3">
          <InfoCard
            title="Доставка"
            text={`Доставляем по Кишинёву. Минимальный заказ — ${toNumber(
              settings.minOrderAmount
            )} MDL.`}
          />
          <InfoCard title="Самовывоз" text="Заберите заказ сами — без наценки за доставку." />
          <InfoCard
            title="Оплата"
            text="Наличными курьеру/на кассе или картой курьеру при получении."
          />
        </div>
      </section>
    </>
  );
}

function InfoCard({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <h3 className="font-display font-semibold">{title}</h3>
      <p className="mt-2 text-sm text-muted-foreground">{text}</p>
    </div>
  );
}
