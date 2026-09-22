"use client";

import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { Check, ChevronDown, Globe } from "lucide-react";
import { Link, usePathname } from "@/i18n/navigation";
import { LOCALES, LOCALE_LABELS, LOCALE_SHORT, type AppLocale } from "@/lib/i18n/locales";
import { cn } from "@/lib/utils";

/**
 * Переключатель языка. Ссылки ведут на ту же страницу на другом языке
 * (путь сохраняется), next-intl запоминает выбор в cookie NEXT_LOCALE.
 * variant="dropdown" — в шапке на десктопе, variant="list" — в мобильном меню.
 */
export function LanguageSwitcher({
  variant = "dropdown",
  onNavigate,
}: {
  variant?: "dropdown" | "list";
  onNavigate?: () => void;
}) {
  const t = useTranslations("lang");
  const locale = useLocale() as AppLocale;
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);
  const rootRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (variant === "list") {
    return (
      <nav aria-label={t("label")}>
        <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-muted-foreground">
          <Globe className="size-4" aria-hidden="true" />
          {t("label")}
        </p>
        <ul className="grid grid-cols-2 gap-2">
          {LOCALES.map((l) => (
            <li key={l}>
              <Link
                href={pathname}
                locale={l}
                lang={l}
                hrefLang={l}
                onClick={onNavigate}
                aria-current={l === locale ? "true" : undefined}
                className={cn(
                  "flex h-11 items-center justify-between rounded-md border px-3 text-sm font-medium",
                  l === locale
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border-strong bg-card hover:bg-surface"
                )}
              >
                {LOCALE_LABELS[l]}
                {l === locale && <Check className="size-4" aria-hidden="true" />}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    );
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={`${t("label")}: ${LOCALE_LABELS[locale]}`}
        className="inline-flex h-11 items-center gap-1.5 rounded-md px-2.5 text-sm font-semibold text-foreground/85 hover:bg-surface hover:text-primary"
      >
        <Globe className="size-4" aria-hidden="true" />
        {LOCALE_SHORT[locale]}
        <ChevronDown className={cn("size-3.5 transition-transform", open && "rotate-180")} aria-hidden="true" />
      </button>
      {open && (
        <ul className="absolute right-0 top-full z-50 mt-1 w-44 overflow-hidden rounded-lg border border-border-strong bg-card py-1 shadow-lift">
          {LOCALES.map((l) => (
            <li key={l}>
              <Link
                href={pathname}
                locale={l}
                lang={l}
                hrefLang={l}
                onClick={() => setOpen(false)}
                aria-current={l === locale ? "true" : undefined}
                className={cn(
                  "flex h-11 items-center justify-between px-3 text-sm hover:bg-surface",
                  l === locale && "font-semibold text-primary"
                )}
              >
                <span>
                  <span className="mr-2 inline-block w-6 text-xs text-muted-foreground">{LOCALE_SHORT[l]}</span>
                  {LOCALE_LABELS[l]}
                </span>
                {l === locale && <Check className="size-4" aria-hidden="true" />}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
