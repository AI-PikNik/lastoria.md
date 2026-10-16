"use client";

import * as React from "react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import { toast } from "sonner";
import { ListChecks, Loader2, Search, X } from "lucide-react";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { MAX_SERIES, type Trend } from "@/lib/analytics-sales";
import type { SeriesOption } from "@/lib/analytics";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Segmented, useSetParams } from "@/components/admin/analytics-controls";

/**
 * Шесть цветов, различимые в паре соседей и при нарушениях цветового зрения.
 * Цвет закреплён за позицией в списке выбранного: убрали серию — остальные
 * не перекрашиваются, пока порядок не изменится.
 */
export const SERIES_COLORS = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300"];

const KIND_TABS = [
  { value: "product", label: "Товары" },
  { value: "category", label: "Группы" },
  { value: "type", label: "Типы групп" },
] as const;

const KIND_NOUN: Record<SeriesOption["kind"], string> = { product: "товар", category: "группа", type: "тип" };

/** Добавить серию на график из любого блока страницы (разбивки, топы) */
export function useAddSeries(selected: string[]) {
  const { set } = useSetParams();
  return React.useCallback(
    (spec: string) => {
      if (selected.includes(spec)) {
        toast.info("Уже на графике «Продажи по товарам и группам»");
      } else if (selected.length >= MAX_SERIES) {
        toast.error(`На графике уже ${MAX_SERIES} линий — уберите одну`);
        return;
      } else {
        set({ s: [...selected, spec] });
        toast.success("Добавлено на график");
      }
      document.getElementById("series-trend")?.scrollIntoView({ behavior: "smooth", block: "start" });
    },
    [selected, set]
  );
}

export function SeriesTrend({ options, trend, totalRevenue }: { options: SeriesOption[]; trend: Trend; totalRevenue: number }) {
  const { set, pending } = useSetParams();
  const [metric, setMetric] = React.useState<"q" | "r">("r");
  const [picking, setPicking] = React.useState(false);
  const selected = trend.series.map((s) => s.spec);
  const kindOf = React.useMemo(() => new Map(options.map((o) => [o.spec, o.kind])), [options]);

  const apply = (specs: string[]) => set({ s: specs.length ? specs : ["none"] });
  const format = (value: number) => (metric === "q" ? `${value} шт.` : formatMoney(value, "admin"));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="outline" onClick={() => setPicking(true)}>
          <ListChecks /> Выбрать товары и группы ({selected.length} из {MAX_SERIES})
        </Button>
        <Segmented
          label="Показатель"
          value={metric}
          onChange={setMetric}
          options={[
            { value: "r", label: "Выручка" },
            { value: "q", label: "Продано, шт" },
          ]}
        />
        {pending && <Loader2 className="size-5 animate-spin text-muted-foreground" aria-label="Загрузка" />}
      </div>

      {trend.series.length === 0 ? (
        <p className="rounded-lg border-2 border-dashed border-border-strong p-6 text-center text-sm text-muted-foreground">
          Нажмите «Выбрать товары и группы» или «на график» в блоках ниже.
        </p>
      ) : (
        <>
          {/* Легенда: цвет + название + тип; × убирает линию */}
          <ul className="flex flex-wrap gap-2">
            {trend.series.map((s, i) => (
              <li
                key={s.spec}
                className="flex items-center gap-2 rounded-full border-2 border-border-strong bg-card py-1 pl-3 pr-1 text-sm font-medium"
              >
                <span aria-hidden="true" className="size-3 rounded-full" style={{ background: SERIES_COLORS[i] }} />
                {s.label}
                <span className="text-xs font-normal text-muted-foreground">{KIND_NOUN[kindOf.get(s.spec) ?? "product"]}</span>
                <button
                  type="button"
                  onClick={() => apply(selected.filter((spec) => spec !== s.spec))}
                  className="flex size-7 items-center justify-center rounded-full text-muted-foreground hover:bg-surface hover:text-destructive"
                  aria-label={`Убрать «${s.label}» с графика`}
                >
                  <X className="size-4" />
                </button>
              </li>
            ))}
          </ul>

          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={trend.points} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="label" stroke="var(--muted-foreground)" fontSize={12} minTickGap={16} />
              <YAxis stroke="var(--muted-foreground)" fontSize={12} width={70} allowDecimals={metric === "r"} />
              <Tooltip
                cursor={{ stroke: "var(--muted-foreground)", strokeDasharray: "4 4" }}
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  // Текст — обычным цветом, серию обозначает кружок: жёлтый/розовый текст плохо читается
                  const rows = trend.series
                    .map((s, i) => ({ label: s.label, color: SERIES_COLORS[i], value: Number(payload[0].payload[`${metric}${i}`] ?? 0) }))
                    .sort((a, b) => b.value - a.value);
                  return (
                    <div className="rounded-lg border border-border-strong bg-card px-3 py-2 text-sm shadow-md">
                      <p className="mb-1 font-semibold">{label}</p>
                      {rows.map((row) => (
                        <p key={row.label} className="flex items-center gap-2">
                          <span aria-hidden="true" className="size-2.5 shrink-0 rounded-full" style={{ background: row.color }} />
                          <span className="flex-1">{row.label}</span>
                          <b className="tabular-nums">{format(row.value)}</b>
                        </p>
                      ))}
                    </div>
                  );
                }}
              />
              {trend.series.map((s, i) => (
                <Line
                  key={s.spec}
                  type="linear"
                  dataKey={`${metric}${i}`}
                  name={s.label}
                  stroke={SERIES_COLORS[i]}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 5, strokeWidth: 2, stroke: "var(--card)" }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>

          {/* Те же данные цифрами */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="py-2 font-medium">Линия</th>
                  <th className="py-2 text-right font-medium">Продано, шт</th>
                  <th className="py-2 text-right font-medium">Выручка</th>
                  <th className="py-2 text-right font-medium">Доля выручки</th>
                </tr>
              </thead>
              <tbody>
                {trend.series.map((s, i) => (
                  <tr key={s.spec} className="border-b border-border last:border-0">
                    <td className="py-2">
                      <span className="inline-flex items-center gap-2">
                        <span aria-hidden="true" className="size-2.5 rounded-full" style={{ background: SERIES_COLORS[i] }} />
                        {s.label}
                      </span>
                    </td>
                    <td className="py-2 text-right tabular-nums">{s.qty}</td>
                    <td className="py-2 text-right tabular-nums">{formatMoney(s.revenue, "admin")}</td>
                    <td className="py-2 text-right tabular-nums">
                      {totalRevenue > 0 ? `${Math.round((s.revenue / totalRevenue) * 1000) / 10}%` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <Dialog open={picking} onOpenChange={setPicking}>
        <DialogContent className="flex max-h-[90vh] max-w-2xl flex-col">
          {picking && (
            <SeriesPicker
              options={options}
              initial={selected}
              onApply={(specs) => {
                apply(specs);
                setPicking(false);
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SeriesPicker({
  options,
  initial,
  onApply,
}: {
  options: SeriesOption[];
  initial: string[];
  onApply: (specs: string[]) => void;
}) {
  const [chosen, setChosen] = React.useState<string[]>(initial);
  const [tab, setTab] = React.useState<SeriesOption["kind"]>("product");
  const [query, setQuery] = React.useState("");
  const full = chosen.length >= MAX_SERIES;

  const toggle = (spec: string) =>
    setChosen((prev) => (prev.includes(spec) ? prev.filter((s) => s !== spec) : prev.length >= MAX_SERIES ? prev : [...prev, spec]));

  const sections = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    const map = new Map<string, SeriesOption[]>();
    for (const option of options) {
      if (option.kind !== tab) continue;
      if (q && !option.label.toLowerCase().includes(q) && !option.group.toLowerCase().includes(q)) continue;
      map.set(option.group, [...(map.get(option.group) ?? []), option]);
    }
    return [...map.entries()];
  }, [options, tab, query]);

  const labelOf = (spec: string) => options.find((o) => o.spec === spec)?.label ?? spec;

  return (
    <>
      <DialogHeader>
        <DialogTitle>Что показать на графике</DialogTitle>
        <p className="text-sm text-muted-foreground">
          Отметьте до {MAX_SERIES} линий — товары, группы и типы можно смешивать. Выбрано: {chosen.length}
          {full && " (максимум)"}
        </p>
      </DialogHeader>

      {chosen.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {chosen.map((spec, i) => (
            <li key={spec}>
              <button
                type="button"
                onClick={() => toggle(spec)}
                className="flex items-center gap-1.5 rounded-full border border-border-strong bg-card px-2.5 py-1 text-xs font-medium hover:border-destructive"
                aria-label={`Убрать «${labelOf(spec)}»`}
              >
                <span aria-hidden="true" className="size-2.5 rounded-full" style={{ background: SERIES_COLORS[i] }} />
                {labelOf(spec)}
                <X className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Segmented label="Что выбирать" value={tab} onChange={setTab} options={[...KIND_TABS]} />
        <div className="relative min-w-48 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Поиск" className="pl-9" aria-label="Поиск" />
        </div>
      </div>

      <div className="min-h-40 flex-1 overflow-y-auto rounded-lg border border-border">
        {sections.length === 0 && <p className="p-4 text-sm text-muted-foreground">Ничего не найдено</p>}
        {sections.map(([group, items]) => (
          <section key={group}>
            {tab === "product" && (
              <h3 className="sticky top-0 z-10 border-b border-border bg-surface px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {group}
              </h3>
            )}
            <ul>
              {items.map((option) => {
                const checked = chosen.includes(option.spec);
                const disabled = !checked && full;
                return (
                  <li key={option.spec}>
                    <label
                      className={cn(
                        "flex cursor-pointer items-center gap-3 border-b border-border px-3 py-2 text-sm last:border-0 hover:bg-surface",
                        disabled && "cursor-not-allowed opacity-50"
                      )}
                    >
                      <Checkbox checked={checked} disabled={disabled} onCheckedChange={() => toggle(option.spec)} />
                      {option.label}
                    </label>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>

      <div className="flex flex-wrap justify-between gap-2">
        <Button variant="ghost" onClick={() => setChosen([])} disabled={chosen.length === 0}>
          Очистить
        </Button>
        <Button onClick={() => onApply(chosen)}>Показать на графике</Button>
      </div>
    </>
  );
}
