import "server-only";
import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/format";
import { pickLocalized, pickTranslation } from "@/lib/i18n/translate";
import type { AppLocale } from "@/lib/i18n/locales";
import { computeCatalogPricing, fetchActivePromos } from "@/lib/pricing-data";
import { localizeVariants, type LocalizedVariant } from "@/lib/variants";
import type { CategoryKind, Prisma } from "@/lib/generated/prisma/client";

/* ─────────────── Группы ─────────────── */

export interface CategoryView {
  id: string;
  slug: string;
  kind: CategoryKind;
  requiresAgeConfirm: boolean;
  imageUrl: string | null;
  name: string;
  description: string;
  seoTitle: string;
  seoDescription: string;
  productCount: number;
  updatedAt: Date;
}

const CATEGORY_FIELDS = ["name", "description", "seoTitle", "seoDescription"] as const;

/** Видимые группы, в которых есть хотя бы один активный товар. */
export const getCategories = cache(async (locale: AppLocale): Promise<CategoryView[]> => {
  const rows = await prisma.category.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    include: {
      translations: true,
      _count: { select: { products: { where: { isActive: true } } } },
    },
  });
  return rows
    .filter((c) => c._count.products > 0)
    .map((c) => {
      const { values } = pickTranslation(c.translations, locale, CATEGORY_FIELDS);
      return {
        id: c.id,
        slug: c.slug,
        kind: c.kind,
        requiresAgeConfirm: c.requiresAgeConfirm,
        imageUrl: c.imageUrl,
        name: values.name || c.slug,
        description: values.description,
        seoTitle: values.seoTitle,
        seoDescription: values.seoDescription,
        productCount: c._count.products,
        updatedAt: c.updatedAt,
      };
    });
});

/* ─────────────── Товары ─────────────── */

export interface ProductCardView {
  id: string;
  slug: string;
  name: string;
  shortDescription: string;
  imageUrl: string | null;
  imageAlt: string;
  categoryId: string;
  categorySlug: string;
  categoryName: string;
  /** Алкоголь или группа 18+ — бейдж и подтверждение возраста обязательны */
  ageRestricted: boolean;
  isVegetarian: boolean;
  isSpicy: boolean;
  isFeatured: boolean;
  hasVariants: boolean;
  price: number;
  oldPrice: number | null;
  hasDiscount: boolean;
  promoName: string | null;
}

export interface ProductDetailView extends ProductCardView {
  basePrice: number;
  description: string;
  ingredientsText: string;
  gallery: string[];
  variants: PricedVariant[];
  seoTitle: string;
  seoDescription: string;
  seoKeywords: string;
  shortAnswer: string;
  ogImageUrl: string | null;
  categoryKind: CategoryKind;
  updatedAt: Date;
}

export interface PricedVariant extends LocalizedVariant {
  /** Цена варианта с учётом действующих промо */
  price: number;
  oldPrice: number | null;
}

const productInclude = {
  translations: true,
  category: { include: { translations: true } },
} satisfies Prisma.ProductInclude;

type ProductWithRelations = Prisma.ProductGetPayload<{ include: typeof productInclude }>;

const PRODUCT_FIELDS = [
  "name",
  "shortDescription",
  "description",
  "ingredientsText",
  "seoTitle",
  "seoDescription",
  "seoKeywords",
  "shortAnswer",
  "imageAlt",
] as const;

export function isAgeRestricted(product: { isAlcohol: boolean; category: { requiresAgeConfirm: boolean; kind: CategoryKind } }) {
  return product.isAlcohol || product.category.requiresAgeConfirm || product.category.kind === "ALCOHOL";
}

async function toViews(rows: ProductWithRelations[], locale: AppLocale) {
  const promos = await fetchActivePromos();
  const pricing = computeCatalogPricing(
    rows.map((p) => ({
      id: p.id,
      categoryId: p.categoryId,
      kind: p.category.kind,
      price: p.price,
      oldPrice: p.oldPrice,
    })),
    promos
  );

  return rows.map((p) => {
    const { values } = pickTranslation(p.translations, locale, PRODUCT_FIELDS);
    const category = pickTranslation(p.category.translations, locale, ["name"] as const);
    const price = pricing.get(p.id)!;
    const name = values.name || p.slug;
    const variants = localizeVariants(p.variants, locale);
    const card: ProductCardView = {
      id: p.id,
      slug: p.slug,
      name,
      shortDescription: values.shortDescription,
      imageUrl: p.imageUrl,
      imageAlt: values.imageAlt || name,
      categoryId: p.categoryId,
      categorySlug: p.category.slug,
      categoryName: category.values.name || p.category.slug,
      ageRestricted: isAgeRestricted(p),
      isVegetarian: p.isVegetarian,
      isSpicy: p.isSpicy,
      isFeatured: p.isFeatured,
      hasVariants: variants.length > 0,
      price: price.price,
      oldPrice: price.oldPrice,
      hasDiscount: price.hasDiscount,
      promoName: price.promoNames ? pickLocalized(price.promoNames, locale) || null : null,
    };
    const gallery = Array.isArray(p.galleryUrls) ? (p.galleryUrls as string[]) : [];
    const variantPricing = computeCatalogPricing(
      variants.map((v) => ({
        id: v.key,
        categoryId: p.categoryId,
        kind: p.category.kind,
        price: Math.max(toNumber(p.price) + v.priceDelta, 0),
        oldPrice: null,
      })),
      promos
    );
    const pricedVariants: PricedVariant[] = variants.map((v) => {
      const vp = variantPricing.get(v.key)!;
      return { ...v, price: vp.price, oldPrice: vp.oldPrice };
    });
    // Для товара с вариантами в карточке показываем «от» минимальной цены варианта
    if (pricedVariants.length > 0) {
      const cheapest = pricedVariants.reduce((min, v) => (v.price < min.price ? v : min));
      card.price = cheapest.price;
      card.oldPrice = cheapest.oldPrice;
      card.hasDiscount = pricedVariants.some((v) => v.oldPrice != null && v.oldPrice > v.price) || card.hasDiscount;
    }
    const detail: ProductDetailView = {
      ...card,
      basePrice: toNumber(p.price),
      description: values.description,
      ingredientsText: values.ingredientsText,
      gallery: [p.imageUrl, ...gallery].filter(
        (url, i, all): url is string => !!url && all.indexOf(url) === i
      ),
      variants: pricedVariants,
      seoTitle: values.seoTitle,
      seoDescription: values.seoDescription,
      seoKeywords: values.seoKeywords,
      shortAnswer: values.shortAnswer,
      ogImageUrl: p.ogImageUrl,
      categoryKind: p.category.kind,
      updatedAt: p.updatedAt,
    };
    return detail;
  });
}

const VISIBLE: Prisma.ProductWhereInput = { isActive: true, category: { isActive: true } };

/** Карточки товаров для каталога/главной. */
export async function getProductCards(
  locale: AppLocale,
  where: Prisma.ProductWhereInput = {},
  take?: number
): Promise<ProductCardView[]> {
  const rows = await prisma.product.findMany({
    where: { AND: [VISIBLE, where] },
    include: productInclude,
    orderBy: [{ category: { sortOrder: "asc" } }, { sortOrder: "asc" }, { createdAt: "asc" }],
    take,
  });
  const views = await toViews(rows, locale);
  // В клиентские компоненты уходит только то, что нужно карточке
  return views.map((v) => ({
    id: v.id,
    slug: v.slug,
    name: v.name,
    shortDescription: v.shortDescription,
    imageUrl: v.imageUrl,
    imageAlt: v.imageAlt,
    categoryId: v.categoryId,
    categorySlug: v.categorySlug,
    categoryName: v.categoryName,
    ageRestricted: v.ageRestricted,
    isVegetarian: v.isVegetarian,
    isSpicy: v.isSpicy,
    isFeatured: v.isFeatured,
    hasVariants: v.hasVariants,
    price: v.price,
    oldPrice: v.oldPrice,
    hasDiscount: v.hasDiscount,
    promoName: v.promoName,
  }));
}

export const getProductDetail = cache(
  async (locale: AppLocale, slug: string): Promise<ProductDetailView | null> => {
    const row = await prisma.product.findFirst({
      where: { AND: [VISIBLE, { slug }] },
      include: productInclude,
    });
    if (!row) return null;
    const [view] = await toViews([row], locale);
    return view;
  }
);

/** Похожие товары из той же группы */
export async function getRelatedProducts(locale: AppLocale, product: ProductDetailView, take = 4) {
  return getProductCards(locale, { categoryId: product.categoryId, NOT: { id: product.id } }, take);
}
