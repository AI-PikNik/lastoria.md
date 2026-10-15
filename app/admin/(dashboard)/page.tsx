import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/auth-guard";
import { resolvePeriod, getSummary } from "@/lib/analytics";
import { getOrdersStampServer } from "@/lib/orders-data";
import { formatMoney, formatDateTime } from "@/lib/format";
import { ACTIVE_STATUSES, FULFILLMENT_LABELS, ORDER_STATUS_COLORS, ORDER_STATUS_LABELS } from "@/lib/constants";
import { StatCard } from "@/components/admin/stat-card";
import { LiveOrders } from "@/components/admin/live-orders";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { ChevronRight } from "lucide-react";
import type { Order } from "@/lib/generated/prisma/client";

export const metadata = { title: "Дашборд" };

export default async function AdminDashboardPage() {
  await requireStaff();
  const range = resolvePeriod("today");
  const [summary, pendingOrders, activeOrders, stamp] = await Promise.all([
    getSummary(range),
    prisma.order.findMany({ where: { status: "PENDING_CONFIRMATION" }, orderBy: { createdAt: "asc" }, take: 30 }),
    prisma.order.findMany({ where: { status: { in: ACTIVE_STATUSES } }, orderBy: { createdAt: "asc" }, take: 30 }),
    getOrdersStampServer(),
  ]);

  const todayLabel = new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    weekday: "long",
    timeZone: "Europe/Chisinau",
  }).format(new Date());

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="font-display text-2xl font-bold">Дашборд</h1>
          <p className="text-sm text-muted-foreground">Показатели за сегодня, {todayLabel}</p>
        </div>
        <LiveOrders initialStamp={stamp.stamp} initialPending={stamp.pending} />
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard title="Выручка сегодня" value={formatMoney(summary.revenue, "admin")} hint="подтверждённые заказы" />
        <StatCard
          title="Заказов сегодня"
          value={String(summary.ordersCount + summary.pendingCount + summary.cancelledCount)}
          hint={`подтверждено ${summary.ordersCount}, ждут ${summary.pendingCount}`}
        />
        <StatCard title="Средний чек" value={formatMoney(summary.avgOrderValue, "admin")} />
        <StatCard title="Отменено сегодня" value={String(summary.cancelledCount)} />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <OrderColumn
          title="Ожидают подтверждения"
          emptyText="Новых заказов нет."
          orders={pendingOrders}
          href="/admin/orders?tab=pending"
          accent
        />
        <OrderColumn
          title="В работе (подтверждённые)"
          emptyText="Подтверждённых заказов в работе нет."
          orders={activeOrders}
          href="/admin/orders?tab=confirmed"
        />
      </div>
    </div>
  );
}

function OrderColumn({
  title,
  emptyText,
  orders,
  href,
  accent,
}: {
  title: string;
  emptyText: string;
  orders: Order[];
  href: string;
  accent?: boolean;
}) {
  return (
    <section className="rounded-xl border border-border bg-card">
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="flex items-center gap-2 font-semibold">
          {title}
          <span className={accent && orders.length > 0 ? "rounded-full bg-primary px-2 text-xs text-primary-foreground" : "rounded-full bg-secondary px-2 text-xs"}>
            {orders.length}
          </span>
        </h2>
        <Link href={href} className="text-sm text-primary hover:underline">
          Все →
        </Link>
      </header>
      {orders.length === 0 ? (
        <p className="p-4 text-sm text-muted-foreground">{emptyText}</p>
      ) : (
        <ul className="divide-y divide-border">
          {orders.map((order) => (
            <li key={order.id}>
              {/* Весь заказ — ссылка: подтверждение, смена статуса и отмена
                  делаются только внутри заказа */}
              <Link
                href={`/admin/orders/${order.id}`}
                className="group flex items-start justify-between gap-3 p-4 transition-colors hover:bg-surface"
              >
                <div className="min-w-0">
                  <p className="font-semibold group-hover:text-primary group-hover:underline">
                    №{order.id.slice(-8).toUpperCase()} · {order.customerName}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {formatDateTime(order.createdAt)} · {FULFILLMENT_LABELS[order.fulfillment]}
                    {order.deliveryZoneName ? ` · ${order.deliveryZoneName}` : ""} · {order.phone}
                  </p>
                  <Badge variant="outline" className={`mt-2 ${ORDER_STATUS_COLORS[order.status]}`}>
                    {ORDER_STATUS_LABELS[order.status]}
                  </Badge>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  <span className="text-lg font-bold">{formatMoney(order.total, "admin")}</span>
                  <span className={buttonVariants({ variant: "outline", size: "sm" })}>
                    Открыть <ChevronRight aria-hidden="true" />
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
