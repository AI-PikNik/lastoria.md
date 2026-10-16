"use client";

import * as React from "react";
import { ChevronDown, LineChart } from "lucide-react";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { BreakdownRow, ProductSummary } from "@/lib/analytics-sales";
import { Segmented } from "@/components/admin/analytics-controls";
import { useAddSeries } from "@/components/admin/charts/series-trend";

type View = "type" | "category";
type Metric = "revenue" | "qty";

const pct = (part: number, total: number) => (total > 0 ? `${Math.round((part / total) * 1000) / 10}%` : "—");

/**
 * Разбивка продаж по типам групп или по группам: полоса = доля, клик по строке
 * раскрывает товары внутри, «на график» добавляет линию на график выше.
 */
export function BreakdownPanel({
  byType,
  byCategory,
  selected,
  totalRevenue,
  totalQty,
}: {
  byType: BreakdownRow[];
  byCategory: BreakdownRow[];
  selected: string[];
  totalRevenue: number;
  totalQty: number;
}) {
  const [view, setView] = React.useState<View>("type");
  const [metric, setMetric] = React.useState<Metric>("revenue");
  const [open, setOpen] = React.useState<string | null>(null);
  const addSeries = useAddSeries(selected);

  const rows = [...(view === "type" ? byType : byCategory)].sort((a, b) => b[metric] - a[metric]);
  const total = metric === "revenue" ? totalRevenue : totalQty;
  const max = Math.max(1, ...rows.map((r) => r[metric]));
  const show = (value: number) => (metric === "revenue" ? formatMoney(value, "admin") : `${value} шт.`);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Segmented
          label="Разбивка"
          value={view}
          onChange={(v) => {
            setView(v);
            setOpen(null);
          }}
          options={[
            { value: "type", label: "По типам групп" },
            { value: "category", label: "По группам товаров" },
          ]}
        />
        <Segmented
          label="Показатель"
          value={metric}
          onChange={setMetric}
          options={[
            { value: "revenue", label: "Выручка" },
            { value: "qty", label: "Штуки" },
          ]}
        />
      </div>

      {rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">За выбранный период продаж нет</p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {rows.map((row) => {
            const expanded = open === row.spec;
            return (
              <li key={row.spec}>
                <div className="flex items-center gap-2 px-3 py-2.5">
                  <button
                    type="button"
                    onClick={() => setOpen(expanded ? null : row.spec)}
                    aria-expanded={expanded}
                    className="flex min-w-0 flex-1 items-center gap-3 text-left"
                  >
                    <ChevronDown
                      className={cn("size-4 shrink-0 text-muted-foreground transition-transform", expanded && "rotate-180")}
                      aria-hidden="true"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-baseline justify-between gap-x-3">
                        <span className="font-semibold">{row.label}</span>
                        <span className="tabular-nums">
                          <b>{show(row[metric])}</b>
                          <span className="ml-2 text-sm text-muted-foreground">{pct(row[metric], total)}</span>
                        </span>
                      </span>
                      <span className="mt-1 block h-2 overflow-hidden rounded-full bg-surface">
                        <span
                          className="block h-full rounded-full bg-primary"
                          style={{ width: `${Math.max(2, (row[metric] / max) * 100)}%` }}
                        />
                      </span>
                      <span className="mt-1 block text-xs text-muted-foreground">
                        {metric === "revenue" ? `${row.qty} шт.` : formatMoney(row.revenue, "admin")} · заказов: {row.orders} ·
                        товаров: {row.products.length}
                      </span>
                    </span>
                  </button>
                  <ToChart onClick={() => addSeries(row.spec)} active={selected.includes(row.spec)} />
                </div>
                {expanded && <ProductList products={row.products} metric={metric} groupTotal={row[metric]} selected={selected} onAdd={addSeries} />}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function ProductList({
  products,
  metric,
  groupTotal,
  selected,
  onAdd,
}: {
  products: ProductSummary[];
  metric: Metric;
  groupTotal: number;
  selected: string[];
  onAdd: (spec: string) => void;
}) {
  const sorted = [...products].sort((a, b) => b[metric] - a[metric]);
  const max = Math.max(1, ...sorted.map((p) => p[metric]));
  return (
    <ul className="border-t border-border bg-surface/60 px-3 py-2 pl-10">
      {sorted.map((p) => (
        <li key={p.spec ?? p.name} className="flex items-center gap-2 py-1.5">
          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm">
              <span>{p.name}</span>
              <span className="tabular-nums">
                {metric === "revenue" ? formatMoney(p.revenue, "admin") : `${p.qty} шт.`}
                <span className="ml-2 text-xs text-muted-foreground">{pct(p[metric], groupTotal)} группы</span>
              </span>
            </span>
            <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-card">
              <span className="block h-full rounded-full bg-primary/70" style={{ width: `${Math.max(2, (p[metric] / max) * 100)}%` }} />
            </span>
          </span>
          {p.spec ? <ToChart onClick={() => onAdd(p.spec!)} active={selected.includes(p.spec)} small /> : <span className="w-9" />}
        </li>
      ))}
    </ul>
  );
}

function ToChart({ onClick, active, small }: { onClick: () => void; active: boolean; small?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={active ? "Уже на графике" : "Добавить на график"}
      aria-label={active ? "Уже на графике" : "Добавить на график"}
      className={cn(
        "flex shrink-0 items-center gap-1 rounded-md border-2 px-2 text-xs font-semibold transition-colors",
        small ? "h-8" : "h-9",
        active ? "border-primary bg-primary text-primary-foreground" : "border-border-strong bg-card hover:border-primary"
      )}
    >
      <LineChart className="size-4" aria-hidden="true" />
      <span className="hidden sm:inline">{active ? "на графике" : "на график"}</span>
    </button>
  );
}
