import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { resolvePeriod, getSummary } from "@/lib/analytics";
import { formatMoney, formatDateTime } from "@/lib/format";
import { ORDER_STATUS_LABELS, ORDER_STATUS_COLORS } from "@/lib/constants";
import { StatCard } from "@/components/admin/stat-card";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function AdminDashboardPage() {
  const range = resolvePeriod("this_month");
  const [summary, recentPending] = await Promise.all([
    getSummary(range),
    prisma.order.findMany({
      where: { status: "PENDING_CONFIRMATION" },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
  ]);

  const ratio =
    summary.confirmedCount + summary.pendingCount > 0
      ? Math.round((summary.confirmedCount / (summary.confirmedCount + summary.pendingCount)) * 100)
      : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Дашборд</h1>
        <p className="text-sm text-muted-foreground">Показатели за текущий месяц</p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard title="Выручка" value={formatMoney(summary.revenue, "admin")} />
        <StatCard title="Заказов" value={String(summary.ordersCount)} />
        <StatCard title="Средний чек" value={formatMoney(summary.avgOrderValue, "admin")} />
        <StatCard title="Неподтверждённые" value={String(summary.pendingCount)} />
        <StatCard title="Подтверждено, %" value={`${ratio}%`} hint="от подтверждённых + неподтверждённых" />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Ожидают подтверждения</CardTitle>
          <Link href="/admin/orders?status=PENDING_CONFIRMATION" className="text-sm text-primary hover:underline">
            Все заказы →
          </Link>
        </CardHeader>
        <CardContent className="space-y-3">
          {recentPending.length === 0 && (
            <p className="text-sm text-muted-foreground">Нет заказов, ожидающих подтверждения.</p>
          )}
          {recentPending.map((order) => (
            <Link
              key={order.id}
              href={`/admin/orders/${order.id}`}
              className="flex items-center justify-between rounded-md border border-border p-3 text-sm hover:bg-secondary"
            >
              <div>
                <p className="font-medium">
                  №{order.id.slice(-8).toUpperCase()} · {order.customerName}
                </p>
                <p className="text-muted-foreground">{formatDateTime(order.createdAt)}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-semibold">{formatMoney(order.total, "admin")}</span>
                <Badge variant="outline" className={ORDER_STATUS_COLORS[order.status]}>
                  {ORDER_STATUS_LABELS[order.status]}
                </Badge>
              </div>
            </Link>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
