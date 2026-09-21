import {
  resolvePeriod,
  getSummary,
  getSalesOverTime,
  getBreakdown,
  getTopProducts,
  getPromoEffectiveness,
  type PeriodKey,
} from "@/lib/analytics";
import { formatMoney } from "@/lib/format";
import { PRODUCT_TYPE_LABELS } from "@/lib/constants";
import { StatCard } from "@/components/admin/stat-card";
import { PeriodSelector } from "@/components/admin/period-selector";
import { SalesChart } from "@/components/admin/charts/sales-chart";
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
}

export default async function AdminAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<AnalyticsSearchParams>;
}) {
  const params = await searchParams;
  const period = params.period ?? "this_month";
  const range = resolvePeriod(period, params.dateFrom, params.dateTo);

  const granularity =
    period === "today" ? "day" : period === "this_year" ? "month" : "day";

  const [summary, sales, breakdown, topProducts, promoEffectiveness] = await Promise.all([
    getSummary(range),
    getSalesOverTime(range, granularity),
    getBreakdown(range),
    getTopProducts(range),
    getPromoEffectiveness(range),
  ]);

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
        <StatCard title="Выручка" value={formatMoney(summary.revenue)} />
        <StatCard title="Заказов" value={String(summary.ordersCount)} />
        <StatCard title="Средний чек" value={formatMoney(summary.avgOrderValue)} />
        <StatCard title="Неподтверждённые" value={String(summary.pendingCount)} />
        <StatCard title="Подтверждено, %" value={`${ratio}%`} />
      </div>

      <Card>
        <CardHeader><CardTitle>Продажи во времени</CardTitle></CardHeader>
        <CardContent>
          <SalesChart data={sales} />
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>По типу товаров</CardTitle></CardHeader>
          <CardContent>
            <BreakdownChart
              data={breakdown.byType.map((b) => ({
                label: PRODUCT_TYPE_LABELS[b.type],
                revenue: b.revenue,
              }))}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>По категориям</CardTitle></CardHeader>
          <CardContent>
            <BreakdownChart
              data={breakdown.byCategory.map((b) => ({ label: b.categoryName, revenue: b.revenue }))}
            />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Топ товаров по выручке</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow><TableHead>Товар</TableHead><TableHead className="text-right">Выручка</TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {topProducts.byRevenue.map((p) => (
                  <TableRow key={p.productId}>
                    <TableCell>{p.name}</TableCell>
                    <TableCell className="text-right">{formatMoney(p.revenue)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Топ товаров по количеству</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow><TableHead>Товар</TableHead><TableHead className="text-right">Продано, шт</TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {topProducts.byQty.map((p) => (
                  <TableRow key={p.productId}>
                    <TableCell>{p.name}</TableCell>
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
                  <TableCell className="text-right">{formatMoney(p.totalDiscount)}</TableCell>
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
