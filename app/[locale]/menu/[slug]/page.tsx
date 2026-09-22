import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { resolveLocaleParam } from "@/lib/i18n/server";
import { getPublicSettings } from "@/lib/settings";
import { getProductDetail, getRelatedProducts } from "@/lib/catalog";
import { formatMoney } from "@/lib/format";
import { buildMetadata, plainText, productJsonLd } from "@/lib/seo";
import { JsonLd } from "@/components/seo/json-ld";
import { Markdown } from "@/components/markdown";
import { Breadcrumbs } from "@/components/public/breadcrumbs";
import { ProductBadges } from "@/components/public/product-badges";
import { ProductGallery } from "@/components/public/product-gallery";
import { ProductPurchasePanel } from "@/components/public/product-purchase-panel";
import { ProductCard } from "@/components/public/product-card";
import { ShortAnswer } from "@/components/public/short-answer";
import { AlcoholGuard } from "@/components/age-gate/alcohol-guard";
import { Flourish, SectionTitle } from "@/theme/decor";

type Props = PageProps<"/[locale]/menu/[slug]">;

async function load(params: Props["params"]) {
  const locale = await resolveLocaleParam(params);
  const { slug } = await params;
  const product = await getProductDetail(locale, slug);
  if (!product) notFound();
  return { locale, product };
}

// Страницы товаров/групп создаются при первом запросе и кэшируются (ISR);
// правки в админке сбрасывают кэш сразу.
export function generateStaticParams() {
  return [];
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, product } = await load(params);
  const settings = await getPublicSettings(locale);
  return buildMetadata({
    locale,
    path: `/menu/${product.slug}`,
    title: product.seoTitle || `${product.name} — ${product.categoryName}`,
    description:
      product.seoDescription ||
      plainText(product.shortDescription || product.description || product.name, 160),
    keywords: product.seoKeywords,
    image: product.ogImageUrl || product.imageUrl,
    imageAlt: product.imageAlt,
    siteName: settings.name,
  });
}

export default async function ProductPage({ params }: Props) {
  const { locale, product } = await load(params);
  const [settings, t, tNav, tMenu, tMeta, related] = await Promise.all([
    getPublicSettings(locale),
    getTranslations({ locale, namespace: "product" }),
    getTranslations({ locale, namespace: "nav" }),
    getTranslations({ locale, namespace: "menu" }),
    getTranslations({ locale, namespace: "meta" }),
    getRelatedProducts(locale, product),
  ]);

  const shortAnswer =
    product.shortAnswer ||
    t("shortAnswer", {
      name: product.name,
      category: product.categoryName.toLowerCase(),
      brand: settings.name,
      city: tMeta("city"),
      price: `${product.hasVariants ? `${tMenu("priceFrom")} ` : ""}${formatMoney(product.price, locale)}`,
      extra: product.ageRestricted ? t("shortAnswerAlcohol") : "",
    });

  const content = (
    <div className="mx-auto max-w-6xl px-4 pt-5">
      <JsonLd
        data={productJsonLd(
          {
            name: product.name,
            description: plainText(product.shortDescription || product.description, 300),
            images: product.gallery,
            price: product.price,
            slug: product.slug,
            category: product.categoryName,
            inStock: true,
            brand: settings.name,
          },
          locale
        )}
      />
      <Breadcrumbs
        locale={locale}
        label={tNav("breadcrumbs")}
        items={[
          { name: tNav("home"), path: "/" },
          { name: tMenu("title"), path: "/menu" },
          { name: product.categoryName, path: `/menu/group/${product.categorySlug}` },
          { name: product.name, path: `/menu/${product.slug}` },
        ]}
      />

      <div className="mt-5 grid gap-8 lg:grid-cols-2 lg:gap-12">
        <ProductGallery images={product.gallery} alt={product.imageAlt} />

        <div>
          <ProductBadges flags={product} />
          <h1 className="mt-3 font-display text-3xl font-extrabold leading-tight text-primary sm:text-4xl">
            {product.name}
          </h1>
          {product.shortDescription && (
            <p className="mt-2 font-accent text-xl italic text-foreground/80">{product.shortDescription}</p>
          )}
          <Flourish className="mt-3" />

          <div className="mt-5">
            <ProductPurchasePanel
              productId={product.id}
              name={product.name}
              price={product.price}
              oldPrice={product.oldPrice}
              ageRestricted={product.ageRestricted}
              variants={product.variants}
              locale={locale}
            />
          </div>

          {product.ingredientsText && (
            <section className="mt-8">
              <h2 className="font-display text-lg font-bold">{t("ingredients")}</h2>
              <p className="mt-1 text-foreground/85">{product.ingredientsText}</p>
            </section>
          )}

          {product.description && (
            <section className="mt-6">
              <h2 className="font-display text-lg font-bold">{t("description")}</h2>
              <div className="mt-1">
                <Markdown content={product.description} />
              </div>
            </section>
          )}

          <ShortAnswer title={t("shortAnswerTitle")} text={shortAnswer} className="mt-8" />
        </div>
      </div>

      {related.length > 0 && (
        <section className="mt-16">
          <SectionTitle title={t("related")} />
          <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-5 lg:grid-cols-4">
            {related.map((item) => (
              <ProductCard key={item.id} product={item} locale={locale} />
            ))}
          </div>
        </section>
      )}
    </div>
  );

  return product.ageRestricted ? <AlcoholGuard>{content}</AlcoholGuard> : content;
}
