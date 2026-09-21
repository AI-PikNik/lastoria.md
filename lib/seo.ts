import type { Metadata } from "next";
import { toNumber } from "@/lib/format";

export function getSiteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(
    /\/$/,
    ""
  );
}

export function absoluteUrl(pathname: string): string {
  const path = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return `${getSiteUrl()}${path}`;
}

export interface BuildMetadataInput {
  title: string;
  description: string;
  path: string;
  image?: string | null;
  keywords?: string | null;
  noIndex?: boolean;
}

export function buildMetadata(input: BuildMetadataInput): Metadata {
  const url = absoluteUrl(input.path);
  const images = input.image ? [{ url: absoluteUrl(input.image) }] : undefined;

  return {
    title: input.title,
    description: input.description,
    keywords: input.keywords ?? undefined,
    alternates: { canonical: url },
    robots: input.noIndex
      ? { index: false, follow: false }
      : { index: true, follow: true },
    openGraph: {
      title: input.title,
      description: input.description,
      url,
      siteName: "La Storia",
      images,
      locale: "ru_RU",
      type: "website",
    },
    twitter: {
      card: images ? "summary_large_image" : "summary",
      title: input.title,
      description: input.description,
      images: images?.map((i) => i.url),
    },
  };
}

export interface RestaurantSettingsLike {
  restaurantName: string;
  restaurantPhone: string;
  restaurantAddress: string;
  workingHours: string;
}

export function organizationJsonLd(settings: RestaurantSettingsLike) {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: settings.restaurantName,
    url: getSiteUrl(),
    telephone: settings.restaurantPhone,
    address: {
      "@type": "PostalAddress",
      streetAddress: settings.restaurantAddress,
      addressCountry: "MD",
    },
  };
}

export function restaurantJsonLd(settings: RestaurantSettingsLike) {
  return {
    "@context": "https://schema.org",
    "@type": "Restaurant",
    name: settings.restaurantName,
    url: getSiteUrl(),
    telephone: settings.restaurantPhone,
    servesCuisine: "Italian",
    priceRange: "$$",
    address: {
      "@type": "PostalAddress",
      streetAddress: settings.restaurantAddress,
      addressCountry: "MD",
    },
    openingHours: settings.workingHours,
    menu: absoluteUrl("/menu"),
  };
}

export interface MenuJsonLdCategory {
  name: string;
  url: string;
}

export function menuJsonLd(categories: MenuJsonLdCategory[]) {
  return {
    "@context": "https://schema.org",
    "@type": "Menu",
    name: "Меню La Storia",
    url: absoluteUrl("/menu"),
    hasMenuSection: categories.map((category) => ({
      "@type": "MenuSection",
      name: category.name,
      url: absoluteUrl(category.url),
    })),
  };
}

export interface ProductJsonLdInput {
  name: string;
  description?: string | null;
  imageUrl?: string | null;
  price: unknown;
  slug: string;
  isActive: boolean;
}

export function productJsonLd(product: ProductJsonLdInput) {
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description ?? undefined,
    image: product.imageUrl ? absoluteUrl(product.imageUrl) : undefined,
    url: absoluteUrl(`/menu/${product.slug}`),
    offers: {
      "@type": "Offer",
      price: toNumber(product.price).toFixed(2),
      priceCurrency: "MDL",
      availability: product.isActive
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
      url: absoluteUrl(`/menu/${product.slug}`),
    },
  };
}

export interface BreadcrumbItem {
  name: string;
  path: string;
}

export function breadcrumbJsonLd(items: BreadcrumbItem[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}
