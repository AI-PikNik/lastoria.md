import Link from "next/link";
import { LineChart } from "lucide-react";
import {
  resolvePeriod,
  getSummary,
  getSalesOverTime,
  getPromoEffectiveness,
  getSeriesOptions,
  getSoldRows,
  type PeriodKey,
} from "@/lib/analytics";
import { availableGranularities, buildBuckets, defaultGranularity, type Granularity } from "@/lib/analytics-period";
import { buildTrend, MAX_SERIES, summarizeSales } from "@/lib/analytics-sales";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { StatCard } from "@/components/admin/stat-card";
import { PeriodSelector } from "@/components/admin/period-selector";
import { SalesChart } from "@/components/admin/charts/sales-chart";
import { SeriesTrend } from "@/components/admin/charts/series-trend";
import { BreakdownPanel } from "@/components/admin/charts/breakdown-panel";
import { GranularityToggle } from "@/components/admin/analytics-controls";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface AnalyticsSearchParams {
  period?: PeriodKey;
  dateFrom?: string;
  dateTo?: string;
  /** Шаг графиков: hour | day | week | month */
  group?: string;
  /** Линии графика «по товарам и группам»: s=p:<товар>&s=c:<группа>&s=t:<тип>; none — ни одной */
  s?: string | string[];
  /** Сортировка таблицы товаров: revenue | qty */
  top?: string;
}

const TOP_LIMIT = 15;

export default async function AdminAnalyticsPage({ searchParams }: { searchParams: Promise<AnalyticsSearchParams> }) {
  const params = await searchParams;
  const period = params.period ?? "this_month";
  const range = resolvePeriod(period, params.dateFrom, params.dateTo);
  const available = availableGranularities(range);
  const granularity: Granularity = available.includes(params.group as Granularity)
    ? (params.group as Granularity)
    : defaultGranularity(range);
  const topBy = params.top === "qty" ? "qty" : "revenue";

  const [summary, sales, soldRows, promoEffectiveness, seriesOptions] = await Promise.all([
    getSummary(range),
    getSalesOverTime(range, granularity),
    getSoldRows(range),
    getPromoEffectiveness(range),
    getSeriesOptions(),
  ]);
  const sold = summarizeSales(soldRows);

  // Линии графика: из адреса, а по умолчанию — три самых продаваемых товара
  const optionBySpec = new Map(seriesOptions.map((o) => [o.spec, o]));
  const requested =
    params.s === undefined
      ? sold.products.flatMap((p) => (p.spec ? [p.spec] : [])).slice(0, 3)
      : (Array.isArray(params.s) ? params.s : [params.s]).filter((spec) => spec !== "none");
  const selected = [...new Set(requested)]
    .map((spec) => optionBySpec.get(spec))
    .filter((o) => o !== undefined)
    .slice(0, MAX_SERIES);
  const trend = buildTrend(soldRows, selected, buildBuckets(range, granularity), granularity);
  const selectedSpecs = trend.series.map((s) => s.spec);

  /** Ссылка с теми же параметрами, но с изменениями */
  const href = (patch: { s?: string[]; top?: string }, hash = "") => {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (key === "s" || key === "top") continue;
      if (typeof value === "string") query.set(key, value);
    }
    for (const spec of patch.s ?? selectedSpecs) query.append("s", spec);
    if ((patch.top ?? topBy) === "qty") query.set("top", "qty");
    return `/admin/analytics?${query.toString()}${hash}`;
  };

  const topProducts = [...sold.products].sort((a, b) => b[topBy] - a[topBy]).slice(0, TOP_LIMIT);
  const ratio =
    summary.confirmedCount + summary.pendingCount > 0
      ? Math.round((summary.confirmedCount / (summary.confirmedCount + summary.pendingCount)) * 100)
      : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold">Аналитика</h1>
        <PeriodSelector current={period} />
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard title="Выручка" value={formatMoney(summary.revenue, "admin")} />
        <StatCard title="Заказов" value={String(summary.ordersCount)} />
        <StatCard title="Средний чек" value={formatMoney(summary.avgOrderValue, "admin")} />
        <StatCard title="Неподтверждённые" value={String(summary.pendingCount)} />
        <StatCard title="Подтверждено, %" value={`${ratio}%`} />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm font-medium text-muted-foreground">Шаг графиков:</span>
        <GranularityToggle current={granularity} available={available} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Продажи во времени</CardTitle>
        </CardHeader>
        <CardContent>
          <SalesChart data={sales} />
        </CardContent>
      </Card>

      <Card id="series-trend" className="scroll-mt-20">
        <CardHeader>
          <CardTitle>Продажи по товарам и группам</CardTitle>
          <p className="text-sm text-muted-foreground">
            Сравните до {MAX_SERIES} линий: отдельные товары, группы товаров или типы групп (пицца, напитки, свои
            группы…).
          </p>
        </CardHeader>
        <CardContent>
          <SeriesTrend options={seriesOptions} trend={trend} totalRevenue={sold.totalRevenue} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Структура продаж</CardTitle>
          <p className="text-sm text-muted-foreground">
            Доля каждого типа или группы в выручке/штуках за период. Нажмите на строку — увидите товары внутри; кнопка
            «на график» добавляет линию на график выше.
          </p>
        </CardHeader>
        <CardContent>
          <BreakdownPanel
            byType={sold.byType}
            byCategory={sold.byCategory}
            selected={selectedSpecs}
            totalRevenue={sold.totalRevenue}
            totalQty={sold.totalQty}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle>Топ-{TOP_LIMIT} товаров</CardTitle>
            <div className="flex gap-1 text-sm">
              {(
                [
                  ["revenue", "по выручке"],
                  ["qty", "по количеству"],
                ] as const
              ).map(([key, label]) => (
                <Link
                  key={key}
                  href={href({ top: key })}
                  scroll={false}
                  className={cn(
                    "rounded-full border-2 px-3 py-1 font-semibold",
                    topBy === key ? "border-primary bg-primary text-primary-foreground" : "border-border-strong bg-card hover:border-primary"
                  )}
                >
                  {label}
                </Link>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Товар</TableHead>
                <TableHead className="text-right">Продано, шт</TableHead>
                <TableHead className="text-right">Выручка</TableHead>
                <TableHead className="text-right">Доля</TableHead>
                <TableHead className="text-right">Заказов</TableHead>
                <TableHead className="text-right">График</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {topProducts.map((p) => {
                const onChart = p.spec !== null && selectedSpecs.includes(p.spec);
                return (
                  <TableRow key={p.spec ?? p.name}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell className="text-right tabular-nums">{p.qty}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatMoney(p.revenue, "admin")}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {sold.totalRevenue > 0 ? `${Math.round((p.revenue / sold.totalRevenue) * 1000) / 10}%` : "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{p.orders}</TableCell>
                    <TableCell className="text-right">
                      {p.spec && optionBySpec.has(p.spec) && (
                        <Link
                          href={href(
                            { s: onChart ? selectedSpecs : [...selectedSpecs, p.spec].slice(-MAX_SERIES) },
                            "#series-trend"
                          )}
                          scroll={false}
                          className={cn(
                            "inline-flex h-8 items-center gap-1 rounded-md border-2 px-2 text-xs font-semibold",
                            onChart ? "border-primary bg-primary text-primary-foreground" : "border-border-strong bg-card hover:border-primary"
                          )}
                        >
                          <LineChart className="size-4" aria-hidden="true" />
                          {onChart ? "на графике" : "на график"}
                        </Link>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
              {topProducts.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-6 text-center text-muted-foreground">
                    За выбранный период продаж нет
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Эффективность промо</CardTitle>
          <p className="text-sm text-muted-foreground">Сколько подтверждённых заказов получили скидку по каждому промо и на какую сумму.</p>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Промо</TableHead>
                <TableHead className="text-right">Заказов</TableHead>
                <TableHead className="text-right">Сумма скидки</TableHead>
                <TableHead className="text-right">Средняя скидка</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {promoEffectiveness.map((p) => (
                <TableRow key={p.promoId}>
                  <TableCell>{p.name}</TableCell>
                  <TableCell className="text-right tabular-nums">{p.ordersCount}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatMoney(p.totalDiscount, "admin")}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {p.ordersCount > 0 ? formatMoney(p.totalDiscount / p.ordersCount, "admin") : "—"}
                  </TableCell>
                </TableRow>
              ))}
              {promoEffectiveness.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="py-6 text-center text-muted-foreground">
                    За выбранный период промо не применялись
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
