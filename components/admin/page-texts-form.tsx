"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ExternalLink, RotateCcw } from "lucide-react";
import { saveUiTranslations } from "@/lib/actions/translations";
import { LOCALES, LOCALE_LABELS, LOCALE_SHORT, localizedPath, type AppLocale } from "@/lib/i18n/locales";
import type { PageTextGroup } from "@/lib/page-texts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { MissingBadge } from "./localized-fields";

type Values = Record<string, Record<AppLocale, string>>;

export function PageTextsForm({ group, values, defaults }: { group: PageTextGroup; values: Values; defaults: Values }) {
  const router = useRouter();
  const [lang, setLang] = React.useState<AppLocale>("ro");
  const [draft, setDraft] = React.useState<Values>(values);
  const [pending, setPending] = React.useState(false);

  const changed = group.fields.flatMap((f) =>
    LOCALES.filter((l) => draft[f.key][l] !== values[f.key][l]).map((l) => ({ key: f.key, locale: l, value: draft[f.key][l] }))
  );

  const save = async () => {
    setPending(true);
    const result = await saveUiTranslations(changed);
    setPending(false);
    if (!result.ok) {
      toast.error(result.error ?? "Не удалось сохранить");
      return;
    }
    toast.success("Тексты сохранены — сайт обновлён");
    router.refresh();
  };

  const missingIn = (l: AppLocale) => group.fields.some((f) => !draft[f.key][l].trim());

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div role="tablist" aria-label="Язык" className="flex flex-wrap gap-1 rounded-lg bg-muted p-1">
          {LOCALES.map((l) => (
            <button
              key={l}
              type="button"
              role="tab"
              aria-selected={lang === l}
              onClick={() => setLang(l)}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium",
                lang === l ? "bg-card shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {LOCALE_SHORT[l]} · {LOCALE_LABELS[l]}
              {missingIn(l) && <MissingBadge />}
            </button>
          ))}
        </div>
        <a
          href={localizedPath(lang, group.url)}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
        >
          Открыть страницу на сайте ({LOCALE_SHORT[lang]}) <ExternalLink className="size-3.5" />
        </a>
      </div>

      <div className="space-y-4 rounded-xl border border-border bg-card p-5">
        {group.fields.map((field) => {
          const value = draft[field.key][lang];
          const isDefault = value === defaults[field.key][lang];
          const id = `${field.key}-${lang}`;
          return (
            <div key={field.key} className="space-y-1">
              <div className="flex items-center justify-between gap-2">
                <label htmlFor={id} className="text-sm font-medium">
                  {field.label}
                </label>
                {!isDefault && (
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => setDraft((d) => ({ ...d, [field.key]: { ...d[field.key], [lang]: defaults[field.key][lang] } }))}
                    title="Вернуть текст по умолчанию"
                  >
                    <RotateCcw className="size-3" /> по умолчанию
                  </button>
                )}
              </div>
              {field.multiline ? (
                <Textarea
                  id={id}
                  rows={value.length > 160 ? 5 : 3}
                  value={value}
                  onChange={(e) => setDraft((d) => ({ ...d, [field.key]: { ...d[field.key], [lang]: e.target.value } }))}
                />
              ) : (
                <Input
                  id={id}
                  value={value}
                  onChange={(e) => setDraft((d) => ({ ...d, [field.key]: { ...d[field.key], [lang]: e.target.value } }))}
                />
              )}
              {field.hint && <p className="text-xs text-muted-foreground">{field.hint}</p>}
              {!value.trim() && <p className="text-xs text-amber-700">Пусто — на сайте этот текст не показывается.</p>}
            </div>
          );
        })}
      </div>

      <div className="sticky bottom-0 z-10 flex items-center justify-between gap-3 border-t border-border bg-background/95 py-3 backdrop-blur">
        <p className="text-xs text-muted-foreground">
          {changed.length > 0 ? `Несохранённых изменений: ${changed.length}` : "Изменений нет"}
        </p>
        <Button size="lg" onClick={save} disabled={pending || changed.length === 0}>
          {pending ? "Сохранение…" : "Сохранить"}
        </Button>
      </div>
    </div>
  );
}
