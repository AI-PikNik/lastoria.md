"use client";

import * as React from "react";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import { formatMoney } from "@/lib/format";
import { Segmented } from "@/components/admin/analytics-controls";
import type { SalesPoint } from "@/lib/analytics";

type Metric = "revenue" | "ordersCount" | "avgCheck";

const METRICS: { value: Metric; label: string }[] = [
  { value: "revenue", label: "Выручка" },
  { value: "ordersCount", label: "Заказы" },
  { value: "avgCheck", label: "Средний чек" },
];

const formatValue = (metric: Metric, value: number) =>
  metric === "ordersCount" ? `${value} шт.` : formatMoney(value, "admin");

/** Продажи во времени: одна метрика на графике (без второй оси), в подсказке — все три */
export function SalesChart({ data }: { data: SalesPoint[] }) {
  const [metric, setMetric] = React.useState<Metric>("revenue");
  const total = data.reduce((sum, p) => sum + p.revenue, 0);
  const orders = data.reduce((sum, p) => sum + p.ordersCount, 0);
  const best = data.reduce<SalesPoint | null>((top, p) => (!top || p[metric] > top[metric] ? p : top), null);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented label="Показатель" options={METRICS} value={metric} onChange={setMetric} />
        <p className="text-sm text-muted-foreground">
          Всего: <b className="text-foreground">{formatMoney(total, "admin")}</b> · {orders} заказов
          {best && best[metric] > 0 && (
            <>
              {" "}
              · лучший период: <b className="text-foreground">{best.label}</b> ({formatValue(metric, best[metric])})
            </>
          )}
        </p>
      </div>
      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="sales-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.25} />
              <stop offset="100%" stopColor="var(--primary)" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis dataKey="label" stroke="var(--muted-foreground)" fontSize={12} minTickGap={16} />
          <YAxis
            stroke="var(--muted-foreground)"
            fontSize={12}
            width={70}
            allowDecimals={metric !== "ordersCount"}
          />
          <Tooltip
            cursor={{ stroke: "var(--muted-foreground)", strokeDasharray: "4 4" }}
            content={({ active, payload }) => {
              const p = active && payload?.[0] ? (payload[0].payload as SalesPoint) : null;
              if (!p) return null;
              return (
                <div className="rounded-lg border border-border-strong bg-card px-3 py-2 text-sm shadow-md">
                  <p className="mb-1 font-semibold">{p.label}</p>
                  {METRICS.map((m) => (
                    <p key={m.value} className={m.value === metric ? "font-semibold" : "text-muted-foreground"}>
                      {m.label}: {formatValue(m.value, p[m.value])}
                    </p>
                  ))}
                </div>
              );
            }}
          />
          <Area
            type="monotone"
            dataKey={metric}
            stroke="var(--primary)"
            strokeWidth={2}
            fill="url(#sales-fill)"
            dot={false}
            activeDot={{ r: 5, strokeWidth: 2, stroke: "var(--card)" }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
