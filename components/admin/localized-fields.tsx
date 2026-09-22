"use client";

import { LOCALES, LOCALE_LABELS, LOCALE_SHORT, type AppLocale } from "@/lib/i18n/locales";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

import type { LocalizedValue } from "@/lib/admin-forms";

export type { LocalizedValue } from "@/lib/admin-forms";

/** Жёлтый бейдж «нет перевода» */
export function MissingBadge({ locale, className }: { locale?: AppLocale; className?: string }) {
  return (
    <Badge variant="warning" className={cn("px-1.5 py-0 text-[11px]", className)} title="Перевод не заполнен — на сайте покажется румынский или другой заполненный язык">
      {locale ? `${LOCALE_SHORT[locale]}: ` : ""}нет перевода
    </Badge>
  );
}

/** Одно и то же поле на 4 языках (RO, RU, EN, IT) */
export function LocalizedFields({
  id,
  label,
  value,
  onChange,
  multiline,
  rows = 3,
  maxLength,
  placeholder,
  hint,
  error,
}: {
  id: string;
  label: string;
  value: LocalizedValue;
  onChange: (value: LocalizedValue) => void;
  multiline?: boolean;
  rows?: number;
  maxLength?: number;
  placeholder?: string;
  hint?: string;
  error?: string;
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-semibold">{label}</legend>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      <div className={cn("grid gap-3", multiline ? "lg:grid-cols-2" : "sm:grid-cols-2")}>
        {LOCALES.map((locale) => {
          const fieldId = `${id}-${locale}`;
          const empty = !value[locale]?.trim();
          return (
            <div key={locale} className="space-y-1">
              <label htmlFor={fieldId} className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <span className="rounded bg-secondary px-1.5 py-0.5 font-semibold text-foreground">{LOCALE_SHORT[locale]}</span>
                {LOCALE_LABELS[locale]}
                {empty && <MissingBadge />}
              </label>
              {multiline ? (
                <Textarea
                  id={fieldId}
                  rows={rows}
                  maxLength={maxLength}
                  placeholder={placeholder}
                  value={value[locale]}
                  onChange={(e) => onChange({ ...value, [locale]: e.target.value })}
                />
              ) : (
                <Input
                  id={fieldId}
                  maxLength={maxLength}
                  placeholder={placeholder}
                  value={value[locale]}
                  onChange={(e) => onChange({ ...value, [locale]: e.target.value })}
                />
              )}
            </div>
          );
        })}
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </fieldset>
  );
}
