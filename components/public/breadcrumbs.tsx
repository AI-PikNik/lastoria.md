import { ChevronRight } from "lucide-react";
import { Link } from "@/i18n/navigation";
import type { AppLocale } from "@/lib/i18n/locales";
import { breadcrumbJsonLd, type BreadcrumbItem } from "@/lib/seo";
import { JsonLd } from "@/components/seo/json-ld";

/** Хлебные крошки + BreadcrumbList JSON-LD. Последний элемент — текущая страница. */
export function Breadcrumbs({ items, locale, label }: { items: BreadcrumbItem[]; locale: AppLocale; label: string }) {
  return (
    <>
      <JsonLd data={breadcrumbJsonLd(items, locale)} />
      <nav aria-label={label} className="text-sm text-muted-foreground">
        <ol className="flex flex-wrap items-center gap-1">
          {items.map((item, index) => {
            const last = index === items.length - 1;
            return (
              <li key={item.path} className="flex items-center gap-1">
                {last ? (
                  <span aria-current="page" className="font-medium text-foreground/80">
                    {item.name}
                  </span>
                ) : (
                  <>
                    <Link href={item.path} className="inline-flex min-h-8 items-center hover:text-primary hover:underline">
                      {item.name}
                    </Link>
                    <ChevronRight className="size-3.5" aria-hidden="true" />
                  </>
                )}
              </li>
            );
          })}
        </ol>
      </nav>
    </>
  );
}
