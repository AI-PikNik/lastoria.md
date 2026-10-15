"use client";

import * as React from "react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import { Loader2, X } from "lucide-react";
import { formatMoney } from "@/lib/format";
import { NativeSelect } from "@/components/ui/native-select";
import { Segmented, useSetParams } from "@/components/admin/analytics-controls";
import { MAX_TREND_PRODUCTS } from "@/lib/analytics-period";
import type { ProductOption, ProductTrend } from "@/lib/analytics";

/** Три цвета, различимые и при нарушениях цветового зрения (см. MAX_TREND_PRODUCTS) */
const COLORS = ["#2a78d6", "#eb6834", "#1baf7a"];

type Metric = "q" | "r";

export function ProductTrendChart({ options, trend }: { options: ProductOption[]; trend: ProductTrend }) {
  const { set, pending } = useSetParams();
  const [metric, setMetric] = React.useState<Metric>("q");
  const selectedIds = trend.products.map((p) => p.id);
  const full = selectedIds.length >= MAX_TREND_PRODUCTS;

  const setProducts = (ids: string[]) => set({ products: ids.length ? ids.join(",") : "none" });

  const groups = React.useMemo(() => {
    const map = new Map<string, ProductOption[]>();
    for (const option of options) {
      if (selectedIds.includes(option.id)) continue;
      map.set(option.group, [...(map.get(option.group) ?? []), option]);
    }
    return Array.from(map.entries());
  }, [options, selectedIds]);

  const format = (value: number) => (metric === "q" ? `${value} шт.` : formatMoney(value, "admin"));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-full max-w-xs">
          <label htmlFor="trend-add" className="mb-1 block text-sm font-medium">
            {full ? `Выбрано ${MAX_TREND_PRODUCTS} товара — уберите один, чтобы добавить` : "Добавить товар на график"}
          </label>
          <NativeSelect
            id="trend-add"
            value=""
            disabled={full}
            onChange={(e) => e.target.value && setProducts([...selectedIds, e.target.value])}
          >
            <option value="">Выберите товар…</option>
            {groups.map(([group, items]) => (
              <optgroup key={group} label={group}>
                {items.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </NativeSelect>
        </div>
        <Segmented
          label="Показатель"
          value={metric}
          onChange={setMetric}
          options={[
            { value: "q", label: "Продано, шт" },
            { value: "r", label: "Выручка" },
          ]}
        />
        {pending && <Loader2 className="mb-2 size-5 animate-spin text-muted-foreground" aria-label="Загрузка" />}
      </div>

      {trend.products.length === 0 ? (
        <p className="rounded-lg border-2 border-dashed border-border-strong p-6 text-center text-sm text-muted-foreground">
          Выберите товар в списке выше или нажмите на товар в таблицах «Топ товаров».
        </p>
      ) : (
        <>
          {/* Легенда = выбранные товары; × убирает товар с графика */}
          <ul className="flex flex-wrap gap-2">
            {trend.products.map((p, i) => (
              <li
                key={p.id}
                className="flex items-center gap-2 rounded-full border-2 border-border-strong bg-card py-1 pl-3 pr-1 text-sm font-medium"
              >
                <span aria-hidden="true" className="size-3 rounded-full" style={{ background: COLORS[i] }} />
                {p.name}
                <button
                  type="button"
                  onClick={() => setProducts(selectedIds.filter((id) => id !== p.id))}
                  className="flex size-7 items-center justify-center rounded-full text-muted-foreground hover:bg-surface hover:text-destructive"
                  aria-label={`Убрать «${p.name}» с графика`}
                >
                  <X className="size-4" />
                </button>
              </li>
            ))}
          </ul>

          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={trend.points} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="label" stroke="var(--muted-foreground)" fontSize={12} minTickGap={16} />
              <YAxis stroke="var(--muted-foreground)" fontSize={12} width={70} allowDecimals={metric === "r"} />
              <Tooltip
                cursor={{ stroke: "var(--muted-foreground)", strokeDasharray: "4 4" }}
                formatter={(value) => format(Number(value ?? 0))}
                contentStyle={{
                  background: "var(--card)",
                  border: "1px solid var(--border-strong)",
                  borderRadius: 8,
                  fontSize: 13,
                }}
              />
              {trend.products.map((p, i) => (
                <Line
                  key={p.id}
                  type="linear"
                  dataKey={`${metric}:${p.id}`}
                  name={p.name}
                  stroke={COLORS[i]}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 5, strokeWidth: 2, stroke: "var(--card)" }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>

          {/* Те же данные цифрами — итоги за период */}
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="py-2 font-medium">Товар</th>
                <th className="py-2 text-right font-medium">Продано, шт</th>
                <th className="py-2 text-right font-medium">Выручка</th>
              </tr>
            </thead>
            <tbody>
              {trend.products.map((p, i) => (
                <tr key={p.id} className="border-b border-border last:border-0">
                  <td className="py-2">
                    <span className="inline-flex items-center gap-2">
                      <span aria-hidden="true" className="size-2.5 rounded-full" style={{ background: COLORS[i] }} />
                      {p.name}
                    </span>
                  </td>
                  <td className="py-2 text-right tabular-nums">{p.qty}</td>
                  <td className="py-2 text-right tabular-nums">{formatMoney(p.revenue, "admin")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
