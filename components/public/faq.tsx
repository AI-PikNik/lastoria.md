import { ChevronDown } from "lucide-react";
import type { AppLocale } from "@/lib/i18n/locales";
import { faqJsonLd } from "@/lib/seo";
import { JsonLd } from "@/components/seo/json-ld";

/** Вопросы-ответы: раскрывающийся список + FAQPage JSON-LD */
export function Faq({ title, items, locale }: { title: string; items: { q: string; a: string }[]; locale: AppLocale }) {
  return (
    <section className="mt-10" aria-labelledby="faq-title">
      <JsonLd data={faqJsonLd(items, locale)} />
      <h2 id="faq-title" className="mb-4 font-display text-2xl font-bold text-primary">
        {title}
      </h2>
      <div className="divide-y divide-border-strong/40 overflow-hidden rounded-xl bg-card shadow-card gold-frame">
        {items.map((item) => (
          <details key={item.q} className="group px-5">
            <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 py-3 font-semibold [&::-webkit-details-marker]:hidden">
              {item.q}
              <ChevronDown className="size-5 shrink-0 text-gold transition-transform group-open:rotate-180" aria-hidden="true" />
            </summary>
            <p className="pb-4 text-foreground/85">{item.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
