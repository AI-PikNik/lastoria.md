/**
 * Типы и заготовки форм админки. Отдельный (не клиентский) модуль, чтобы
 * серверные страницы могли готовить начальные значения для клиентских форм.
 */
import type { AppLocale } from "@/lib/i18n/locales";

export type LocalizedValue = Record<AppLocale, string>;

export function emptyLocalized(): LocalizedValue {
  return { ro: "", ru: "", en: "", it: "" };
}

/** JSON-карта из БД → объект со всеми 4 языками */
export function toLocalized(value: unknown): LocalizedValue {
  const map = (value && typeof value === "object" ? value : {}) as Partial<LocalizedValue>;
  return { ro: map.ro ?? "", ru: map.ru ?? "", en: map.en ?? "", it: map.it ?? "" };
}

export interface ProductTranslationForm {
  name: string;
  shortDescription: string;
  description: string;
  ingredientsText: string;
  seoTitle: string;
  seoDescription: string;
  seoKeywords: string;
  shortAnswer: string;
  imageAlt: string;
}

export interface ProductFormValues {
  slug: string;
  categoryId: string;
  price: string;
  oldPrice: string;
  isAlcohol: boolean;
  isVegetarian: boolean;
  isSpicy: boolean;
  isActive: boolean;
  isFeatured: boolean;
  sku: string;
  sortOrder: string;
  stock: string;
  images: string[];
  ogImageUrl: string | null;
  variants: { key: string; priceDelta: string; names: LocalizedValue }[];
  translations: Record<AppLocale, ProductTranslationForm>;
}

const EMPTY_TR: ProductTranslationForm = {
  name: "",
  shortDescription: "",
  description: "",
  ingredientsText: "",
  seoTitle: "",
  seoDescription: "",
  seoKeywords: "",
  shortAnswer: "",
  imageAlt: "",
};

export function emptyProductForm(categoryId = ""): ProductFormValues {
  return {
    slug: "",
    categoryId,
    price: "",
    oldPrice: "",
    isAlcohol: false,
    isVegetarian: false,
    isSpicy: false,
    isActive: true,
    isFeatured: false,
    sku: "",
    sortOrder: "0",
    stock: "",
    images: [],
    ogImageUrl: null,
    variants: [],
    translations: { ro: { ...EMPTY_TR }, ru: { ...EMPTY_TR }, en: { ...EMPTY_TR }, it: { ...EMPTY_TR } },
  };
}

