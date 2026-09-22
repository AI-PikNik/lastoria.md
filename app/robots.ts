import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/site-url";
import { LOCALES, DEFAULT_LOCALE } from "@/lib/i18n/locales";

const PRIVATE = ["/cart", "/checkout", "/order"];

export default function robots(): MetadataRoute.Robots {
  const disallow = ["/admin", "/api"];
  for (const locale of LOCALES) {
    for (const path of PRIVATE) disallow.push(locale === DEFAULT_LOCALE ? path : `/${locale}${path}`);
  }
  return {
    rules: [{ userAgent: "*", allow: "/", disallow }],
    sitemap: `${getSiteUrl()}/sitemap.xml`,
  };
}
