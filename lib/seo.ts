import type { Metadata } from "next";
import { toNumber } from "@/lib/format";
import {
  DEFAULT_LOCALE,
  LOCALES,
  LOCALE_REGION,
  localizedPath,
  type AppLocale,
} from "@/lib/i18n/locales";
import { absoluteUrl, getSiteUrl } from "@/lib/site-url";

export { absoluteUrl, getSiteUrl } from "@/lib/site-url";

/** hreflang-коды: ro, ru, en, it (+ x-default → румынская версия) */
export function hreflangAlternates(path: string): Record<string, string> {
  const languages: Record<string, string> = {};
  for (const locale of LOCALES) languages[locale] = absoluteUrl(localizedPath(locale, path));
  languages["x-default"] = absoluteUrl(localizedPath(DEFAULT_LOCALE, path));
  return languages;
}

export interface BuildMetadataInput {
  locale: AppLocale;
  /** Путь без префикса языка: "/", "/menu", "/menu/margherita" */
  path: string;
  title: string;
  description: string;
  image?: string | null;
  imageAlt?: string;
  keywords?: string | null;
  noIndex?: boolean;
  /** Абсолютный заголовок (без шаблона « | La Storia») */
  absoluteTitle?: boolean;
  siteName?: string;
}

export function buildMetadata(input: BuildMetadataInput): Metadata {
  const url = absoluteUrl(localizedPath(input.locale, input.path));
  const images = input.image
    ? [{ url: absoluteUrl(input.image), alt: input.imageAlt ?? input.title }]
    : [{ url: absoluteUrl("/brand/poster.jpg"), width: 1800, height: 1200, alt: input.siteName ?? "La Storia" }];

  return {
    title: input.absoluteTitle ? { absolute: input.title } : input.title,
    description: input.description,
    keywords: input.keywords || undefined,
    alternates: input.noIndex
      ? undefined
      : { canonical: url, languages: hreflangAlternates(input.path) },
    robots: input.noIndex ? { index: false, follow: false } : { index: true, follow: true },
    openGraph: {
      title: input.title,
      description: input.description,
      url,
      siteName: input.siteName ?? "La Storia",
      images,
      locale: LOCALE_REGION[input.locale],
      alternateLocale: LOCALES.filter((l) => l !== input.locale).map((l) => LOCALE_REGION[l]),
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: input.title,
      description: input.description,
      images: images.map((i) => i.url),
    },
  };
}

/* ─────────────── JSON-LD ─────────────── */

export interface RestaurantLd {
  name: string;
  phone: string;
  address: string;
  email?: string | null;
  hours?: string;
  logoUrl?: string | null;
  imageUrl?: string | null;
  geo?: { lat: number; lng: number } | null;
  description?: string;
}

export function organizationJsonLd(s: RestaurantLd) {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${getSiteUrl()}/#organization`,
    name: s.name,
    url: getSiteUrl(),
    logo: s.logoUrl ? absoluteUrl(s.logoUrl) : absoluteUrl("/icon"),
    telephone: s.phone,
    email: s.email || undefined,
    address: { "@type": "PostalAddress", streetAddress: s.address, addressCountry: "MD" },
  };
}

export function restaurantJsonLd(s: RestaurantLd, locale: AppLocale) {
  return {
    "@context": "https://schema.org",
    "@type": "Restaurant",
    "@id": `${getSiteUrl()}/#restaurant`,
    name: s.name,
    description: s.description || undefined,
    url: absoluteUrl(localizedPath(locale, "/")),
    image: absoluteUrl(s.imageUrl || "/brand/poster.jpg"),
    telephone: s.phone,
    email: s.email || undefined,
    servesCuisine: ["Italian", "Pizza"],
    priceRange: "MDL",
    currenciesAccepted: "MDL",
    paymentAccepted: "Cash, Credit Card",
    address: { "@type": "PostalAddress", streetAddress: s.address, addressCountry: "MD" },
    geo: s.geo ? { "@type": "GeoCoordinates", latitude: s.geo.lat, longitude: s.geo.lng } : undefined,
    // Часы работы — свободным текстом из настроек (не выдумываем структурированный график)
    openingHours: s.hours || undefined,
    hasMenu: absoluteUrl(localizedPath(locale, "/menu")),
    parentOrganization: { "@id": `${getSiteUrl()}/#organization` },
  };
}

export interface MenuLdSection {
  name: string;
  path: string;
  items: { name: string; description?: string; path: string; price: number; image?: string | null }[];
}

export function menuJsonLd(name: string, locale: AppLocale, sections: MenuLdSection[]) {
  return {
    "@context": "https://schema.org",
    "@type": "Menu",
    name,
    inLanguage: locale,
    url: absoluteUrl(localizedPath(locale, "/menu")),
    hasMenuSection: sections.map((section) => ({
      "@type": "MenuSection",
      name: section.name,
      url: absoluteUrl(localizedPath(locale, section.path)),
      hasMenuItem: section.items.map((item) => ({
        "@type": "MenuItem",
        name: item.name,
        description: item.description || undefined,
        url: absoluteUrl(localizedPath(locale, item.path)),
        image: item.image ? absoluteUrl(item.image) : undefined,
        offers: {
          "@type": "Offer",
          price: item.price.toFixed(2),
          priceCurrency: "MDL",
        },
      })),
    })),
  };
}

export interface ProductLdInput {
  name: string;
  description?: string | null;
  images: string[];
  price: unknown;
  slug: string;
  category: string;
  sku?: string | null;
  inStock: boolean;
  brand: string;
}

/** Product + Offer. Без AggregateRating/Review — отзывов на сайте нет, выдумывать нельзя. */
export function productJsonLd(p: ProductLdInput, locale: AppLocale) {
  const url = absoluteUrl(localizedPath(locale, `/menu/${p.slug}`));
  return {
    "@context": "https://schema.org",
    "@type": ["Product", "MenuItem"],
    name: p.name,
    description: p.description || undefined,
    image: p.images.length ? p.images.map((i) => absoluteUrl(i)) : undefined,
    url,
    sku: p.sku || undefined,
    category: p.category,
    brand: { "@type": "Brand", name: p.brand },
    inLanguage: locale,
    offers: {
      "@type": "Offer",
      price: toNumber(p.price).toFixed(2),
      priceCurrency: "MDL",
      availability: p.inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      url,
      seller: { "@id": `${getSiteUrl()}/#organization` },
    },
  };
}

export interface BreadcrumbItem {
  name: string;
  /** путь без префикса языка */
  path: string;
}

export function breadcrumbJsonLd(items: BreadcrumbItem[], locale: AppLocale) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteUrl(localizedPath(locale, item.path)),
    })),
  };
}

export function faqJsonLd(items: { q: string; a: string }[], locale: AppLocale) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    inLanguage: locale,
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  };
}

/* ─────────────── Короткие ответы для AI-поиска ─────────────── */

export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/** Проверка «короткого ответа»: 40–80 слов */
export function isShortAnswerLengthOk(text: string): boolean {
  const n = countWords(text);
  return n >= 40 && n <= 80;
}

/** Обрезает markdown до простого текста для description/og */
export function plainText(markdown: string, max = 160): string {
  const plain = markdown
    .replace(/!\[[^\]]*]\([^)]*\)/g, "")
    .replace(/\[([^\]]*)]\([^)]*\)/g, "$1")
    .replace(/[#*_`>~|-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return plain.length > max ? `${plain.slice(0, max - 1).trimEnd()}…` : plain;
}
