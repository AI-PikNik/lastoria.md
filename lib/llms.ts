/**
 * Генератор /llms.txt — краткая справка о сайте для AI-ассистентов
 * (формат llmstxt.org: заголовок, цитата-описание, разделы со ссылками).
 * Собирается автоматически из настроек, меню и зон доставки — вручную
 * ничего заполнять не нужно, после правок в админке файл обновляется сам.
 */
import { LOCALES, LOCALE_LABELS, localizedPath, type AppLocale } from "@/lib/i18n/locales";

export interface LlmsData {
  siteUrl: string;
  name: string;
  description: string;
  address: string;
  phone: string;
  email: string | null;
  hours: string;
  minOrder: string;
  groups: {
    name: string;
    slug: string;
    ageRestricted: boolean;
    products: { name: string; slug: string; price: string; description: string }[];
  }[];
  delivery: { city: string; zones: { name: string; fee: string }[] }[];
  locale: AppLocale;
}

function url(data: LlmsData, path: string, locale: AppLocale = data.locale) {
  return `${data.siteUrl}${localizedPath(locale, path)}`;
}

function oneLine(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

export function buildLlmsTxt(data: LlmsData): string {
  const lines: string[] = [];
  lines.push(`# ${data.name}`, "", `> ${oneLine(data.description)}`, "");
  lines.push(
    `- Address: ${data.address}`,
    `- Phone: ${data.phone}`,
    ...(data.email ? [`- Email: ${data.email}`] : []),
    ...(data.hours ? [`- Opening hours: ${data.hours}`] : []),
    `- Minimum order: ${data.minOrder}`,
    "- Currency: MDL (Moldovan leu)",
    "- Ordering: online on the website; an operator calls back to confirm. Delivery or pickup.",
    "- Payment: cash or card on delivery/pickup. No online card payment.",
    "- Alcohol: sold to persons 18+ only; age confirmation is required.",
    `- Languages: ${LOCALES.map((l) => `${LOCALE_LABELS[l]} (${url(data, "/", l)})`).join(", ")}`,
    ""
  );

  lines.push("## Main pages", "");
  lines.push(
    `- [Menu](${url(data, "/menu")}): full menu with prices`,
    `- [Delivery and payment](${url(data, "/delivery")}): delivery zones, fees, minimum order`,
    `- [About](${url(data, "/about")}): about the pizzeria and FAQ`,
    `- [Contacts](${url(data, "/contacts")}): address, phone, opening hours`,
    `- [Alcohol 18+ policy](${url(data, "/age-policy")})`,
    ""
  );

  if (data.groups.length > 0) {
    lines.push("## Menu", "");
    for (const group of data.groups) {
      lines.push(`### [${group.name}](${url(data, `/menu/group/${group.slug}`)})${group.ageRestricted ? " (18+)" : ""}`, "");
      for (const p of group.products) {
        const desc = p.description ? `: ${oneLine(p.description)}` : "";
        lines.push(`- [${p.name}](${url(data, `/menu/${p.slug}`)}) — ${p.price}${desc}`);
      }
      lines.push("");
    }
  }

  if (data.delivery.length > 0) {
    lines.push("## Delivery zones", "");
    for (const city of data.delivery) {
      for (const zone of city.zones) lines.push(`- ${city.city}, ${zone.name}: ${zone.fee}`);
    }
    lines.push("");
  }

  lines.push("## Optional", "", `- [Sitemap](${data.siteUrl}/sitemap.xml)`, "");
  return lines.join("\n");
}
