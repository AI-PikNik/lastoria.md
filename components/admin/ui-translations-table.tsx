"use client";

import * as React from "react";
import { toast } from "sonner";
import { RotateCcw } from "lucide-react";
import { saveUiTranslation } from "@/lib/actions/translations";
import { LOCALES, LOCALE_SHORT, type AppLocale } from "@/lib/i18n/locales";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type Flat = Record<string, string>;

export function UiTranslationsTable({
  base,
  overrides,
}: {
  base: Record<AppLocale, Flat>;
  overrides: Record<AppLocale, Flat>;
}) {
  const [values, setValues] = React.useState(overrides);
  const [query, setQuery] = React.useState("");
  const [ns, setNs] = React.useState("");
  const [onlyMissing, setOnlyMissing] = React.useState(false);
  const [onlyEdited, setOnlyEdited] = React.useState(false);

  const keys = Object.keys(base.ro);
  const namespaces = [...new Set(keys.map((k) => k.split(".")[0]))];
  const effective = (locale: AppLocale, key: string) => values[locale][key] ?? base[locale][key] ?? "";
  const isMissing = (locale: AppLocale, key: string) => !effective(locale, key).trim();

  const q = query.trim().toLowerCase();
  const visible = keys.filter((key) => {
    if (ns && !key.startsWith(`${ns}.`)) return false;
    if (onlyMissing && !LOCALES.some((l) => isMissing(l, key))) return false;
    if (onlyEdited && !LOCALES.some((l) => values[l][key] !== undefined)) return false;
    if (!q) return true;
    return key.toLowerCase().includes(q) || LOCALES.some((l) => effective(l, key).toLowerCase().includes(q));
  });

  const save = async (locale: AppLocale, key: string, value: string) => {
    if (value === effective(locale, key)) return;
    const result = await saveUiTranslation(key, locale, value);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setValues((prev) => {
      const next = { ...prev, [locale]: { ...prev[locale] } };
      if (!value.trim() || value === base[locale][key]) delete next[locale][key];
      else next[locale][key] = value;
      return next;
    });
    toast.success(`Сохранено: ${key} (${LOCALE_SHORT[locale]})`);
  };

  const missingTotal = keys.filter((k) => LOCALES.some((l) => isMissing(l, k))).length;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Input className="h-9 w-64" placeholder="Поиск по ключу или тексту" value={query} onChange={(e) => setQuery(e.target.value)} />
        <div className="w-48">
          <NativeSelect className="h-9" value={ns} onChange={(e) => setNs(e.target.value)}>
            <option value="">Все разделы</option>
            {namespaces.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </NativeSelect>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={onlyMissing} onChange={(e) => setOnlyMissing(e.target.checked)} />
          Только без перевода ({missingTotal})
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={onlyEdited} onChange={(e) => setOnlyEdited(e.target.checked)} />
          Только изменённые в админке
        </label>
        <span className="ml-auto text-xs text-muted-foreground">Показано: {visible.length} из {keys.length}</span>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full min-w-[960px] text-sm">
          <thead className="bg-muted text-left text-xs">
            <tr>
              <th className="w-56 px-3 py-2">Ключ</th>
              {LOCALES.map((l) => (
                <th key={l} className="px-3 py-2">
                  {LOCALE_SHORT[l]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.slice(0, 300).map((key) => (
              <tr key={key} className="border-t border-border align-top">
                <td className="px-3 py-2 font-mono text-[11px] text-muted-foreground">{key}</td>
                {LOCALES.map((l) => (
                  <td key={l} className="px-2 py-1.5">
                    <Cell
                      value={effective(l, key)}
                      edited={values[l][key] !== undefined}
                      missing={isMissing(l, key)}
                      onSave={(value) => save(l, key, value)}
                      onReset={() => save(l, key, base[l][key] ?? "")}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {visible.length > 300 && <p className="p-3 text-xs text-muted-foreground">Показаны первые 300 — уточните поиск.</p>}
      </div>
    </div>
  );
}

function Cell({
  value,
  edited,
  missing,
  onSave,
  onReset,
}: {
  value: string;
  edited: boolean;
  missing: boolean;
  onSave: (value: string) => void;
  onReset: () => void;
}) {
  const [draft, setDraft] = React.useState(value);
  const [source, setSource] = React.useState(value);
  if (source !== value) {
    setSource(value);
    setDraft(value);
  }
  return (
    <div className="relative">
      <Textarea
        rows={draft.length > 60 ? 3 : 1}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => onSave(draft)}
        className={cn(
          "min-h-9 resize-y px-2 py-1.5 text-xs",
          missing && "border-amber-400 bg-amber-50",
          edited && "border-primary/50"
        )}
      />
      {edited && (
        <button type="button" onClick={onReset} title="Вернуть текст по умолчанию" className="absolute right-1 top-1 rounded p-0.5 text-muted-foreground hover:bg-muted">
          <RotateCcw className="size-3" />
        </button>
      )}
    </div>
  );
}
