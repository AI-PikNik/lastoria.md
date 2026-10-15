import Link from "next/link";
import {
  resolvePeriod,
  getSummary,
  getSalesOverTime,
  getBreakdown,
  getTopProducts,
  getPromoEffectiveness,
  getProductOptions,
  getProductTrend,
  type PeriodKey,
} from "@/lib/analytics";
import {
  availableGranularities,
  defaultGranularity,
  MAX_TREND_PRODUCTS,
  type Granularity,
} from "@/lib/analytics-period";
import { formatMoney } from "@/lib/format";
import { CATEGORY_KIND_LABELS } from "@/lib/constants";
import { StatCard } from "@/components/admin/stat-card";
import { PeriodSelector } from "@/components/admin/period-selector";
import { SalesChart } from "@/components/admin/charts/sales-chart";
import { ProductTrendChart } from "@/components/admin/charts/product-trend";
import { GranularityToggle } from "@/components/admin/analytics-controls";
import { BreakdownChart } from "@/components/admin/charts/breakdown-chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface AnalyticsSearchParams {
  period?: PeriodKey;
  dateFrom?: string;
  dateTo?: string;
  /** Шаг графиков: hour | day | week | month */
  group?: string;
  /** Товары на графике «Товар во времени» через запятую; none — ни одного */
  products?: string;
}

export default async function AdminAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<AnalyticsSearchParams>;
}) {
  const params = await searchParams;
  const period = params.period ?? "this_month";
  const range = resolvePeriod(period, params.dateFrom, params.dateTo);

  const available = availableGranularities(range);
  const granularity: Granularity = available.includes(params.group as Granularity)
    ? (params.group as Granularity)
    : defaultGranularity(range);

  const [summary, sales, breakdown, topProducts, promoEffectiveness, productOptions] = await Promise.all([
    getSummary(range),
    getSalesOverTime(range, granularity),
    getBreakdown(range),
    getTopProducts(range),
    getPromoEffectiveness(range),
    getProductOptions(),
  ]);

  // Товары для графика: из адреса, а если не выбраны — самый продаваемый за период
  const optionById = new Map(productOptions.map((o) => [o.id, o]));
  const requested =
    params.products === undefined
      ? topProducts.byRevenue.slice(0, 1).map((p) => p.productId)
      : params.products.split(",");
  const trendProducts = [...new Set(requested)]
    .map((id) => optionById.get(id))
    .filter((o) => o !== undefined)
    .slice(0, MAX_TREND_PRODUCTS);
  const trend = await getProductTrend(range, granularity, trendProducts);

  /** Ссылка «показать товар на графике» с сохранением остальных параметров */
  const trendHref = (productId: string) => {
    const ids = trendProducts.map((p) => p.id).filter((id) => id !== productId);
    const next = [...ids, productId].slice(-MAX_TREND_PRODUCTS);
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) if (typeof value === "string") query.set(key, value);
    query.set("products", next.join(","));
    return `/admin/analytics?${query.toString()}#product-trend`;
  };

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
        <CardHeader><CardTitle>Продажи во времени</CardTitle></CardHeader>
        <CardContent>
          <SalesChart data={sales} />
        </CardContent>
      </Card>

      <Card id="product-trend" className="scroll-mt-20">
        <CardHeader>
          <CardTitle>Товар во времени</CardTitle>
          <p className="text-sm text-muted-foreground">
            Сравните до {MAX_TREND_PRODUCTS} товаров: сколько штук продано и на какую сумму в каждый период.
          </p>
        </CardHeader>
        <CardContent>
          <ProductTrendChart options={productOptions} trend={trend} />
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>По типам групп (пицца, напитки, алкоголь…)</CardTitle></CardHeader>
          <CardContent>
            <BreakdownChart
              data={breakdown.byType.map((b) => ({
                label: CATEGORY_KIND_LABELS[b.type],
                revenue: b.revenue,
              }))}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>По группам товаров</CardTitle></CardHeader>
          <CardContent>
            <BreakdownChart
              data={breakdown.byCategory.map((b) => ({ label: b.categoryName, revenue: b.revenue }))}
            />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Топ товаров по выручке</CardTitle><p className="text-sm text-muted-foreground">Нажмите на товар — он появится на графике</p></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow><TableHead>Товар</TableHead><TableHead className="text-right">Выручка</TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {topProducts.byRevenue.map((p) => (
                  <TableRow key={p.productId}>
                    <TableCell>
                      {optionById.has(p.productId) ? (
                        <Link
                          href={trendHref(p.productId)}
                          className="font-medium text-primary underline-offset-4 hover:underline"
                          title="Показать на графике «Товар во времени»"
                        >
                          {p.name} ↗
                        </Link>
                      ) : (
                        p.name
                      )}
                    </TableCell>
                    <TableCell className="text-right">{formatMoney(p.revenue, "admin")}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Топ товаров по количеству</CardTitle><p className="text-sm text-muted-foreground">Нажмите на товар — он появится на графике</p></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow><TableHead>Товар</TableHead><TableHead className="text-right">Продано, шт</TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {topProducts.byQty.map((p) => (
                  <TableRow key={p.productId}>
                    <TableCell>
                      {optionById.has(p.productId) ? (
                        <Link
                          href={trendHref(p.productId)}
                          className="font-medium text-primary underline-offset-4 hover:underline"
                          title="Показать на графике «Товар во времени»"
                        >
                          {p.name} ↗
                        </Link>
                      ) : (
                        p.name
                      )}
                    </TableCell>
                    <TableCell className="text-right">{p.qty}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Эффективность промо</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Промо</TableHead>
                <TableHead className="text-right">Заказов</TableHead>
                <TableHead className="text-right">Сумма скидки</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {promoEffectiveness.map((p) => (
                <TableRow key={p.promoId}>
                  <TableCell>{p.name}</TableCell>
                  <TableCell className="text-right">{p.ordersCount}</TableCell>
                  <TableCell className="text-right">{formatMoney(p.totalDiscount, "admin")}</TableCell>
                </TableRow>
              ))}
              {promoEffectiveness.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="py-6 text-center text-muted-foreground">
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
