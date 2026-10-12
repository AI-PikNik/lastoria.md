import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { cn } from "@/lib/utils";
import { formatMoney, formatDateTime } from "@/lib/format";
import {
  ACTIVE_STATUSES,
  FULFILLMENT_LABELS,
  ORDER_STATUS_COLORS,
  ORDER_STATUS_LABELS,
} from "@/lib/constants";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { OrdersFilterBar } from "@/components/admin/orders-filter-bar";
import { OrderRowLink } from "@/components/admin/order-row-link";
import { LiveOrders } from "@/components/admin/live-orders";
import { requireStaff } from "@/lib/auth-guard";
import { getOrdersStampServer } from "@/lib/orders-data";
import type { CategoryKind, Prisma } from "@/lib/generated/prisma/client";
import { getCategoryOptions } from "@/lib/admin-data";
import { LOCALE_SHORT, isLocale } from "@/lib/i18n/locales";

type Tab = "all" | "pending" | "confirmed" | "cancelled" | "completed";

interface OrdersSearchParams {
  tab?: Tab;
  dateFrom?: string;
  dateTo?: string;
  fulfillment?: string;
  productType?: string;
  categoryId?: string;
  promoId?: string;
  q?: string;
}

const TABS: { key: Tab; label: string }[] = [
  { key: "all", label: "Все" },
  { key: "pending", label: "Неподтверждённые" },
  { key: "confirmed", label: "Подтверждённые (в работе)" },
  { key: "completed", label: "Завершённые" },
  { key: "cancelled", label: "Отменённые" },
];

export const metadata = { title: "Заказы" };

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<OrdersSearchParams>;
}) {
  await requireStaff();
  const params = await searchParams;
  const tab = params.tab ?? "all";

  const where: Prisma.OrderWhereInput = {};

  if (tab === "pending") where.status = "PENDING_CONFIRMATION";
  // «Подтверждённые» — только те, что ещё в работе; завершённые — на своей вкладке
  if (tab === "confirmed") where.status = { in: ACTIVE_STATUSES };
  if (tab === "cancelled") where.status = "CANCELLED";
  if (tab === "completed") where.status = "COMPLETED";

  if (params.dateFrom || params.dateTo) {
    where.createdAt = {
      ...(params.dateFrom ? { gte: new Date(params.dateFrom) } : {}),
      ...(params.dateTo ? { lte: new Date(`${params.dateTo}T23:59:59`) } : {}),
    };
  }

  if (params.fulfillment) {
    where.fulfillment = params.fulfillment as Prisma.OrderWhereInput["fulfillment"];
  }

  if (params.q) {
    where.OR = [
      { customerName: { contains: params.q, mode: "insensitive" } },
      { phone: { contains: params.q, mode: "insensitive" } },
      { id: { contains: params.q, mode: "insensitive" } },
    ];
  }

  const [orders, categories] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: { items: { include: { product: { include: { category: true } } } } },
      take: 200,
    }),
    getCategoryOptions(),
  ]);

  let filtered = orders;
  if (params.productType) {
    filtered = filtered.filter((o) =>
      o.items.some((i) => i.product?.category.kind === (params.productType as CategoryKind))
    );
  }
  if (params.categoryId) {
    filtered = filtered.filter((o) =>
      o.items.some((i) => i.product?.categoryId === params.categoryId)
    );
  }
  if (params.promoId) {
    filtered = filtered.filter((o) => {
      const promos = Array.isArray(o.appliedPromos)
        ? (o.appliedPromos as unknown as { id: string }[])
        : [];
      return promos.some((p) => p.id === params.promoId);
    });
  }

  const stamp = await getOrdersStampServer();
  const promos = await prisma.promo.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h1 className="font-display text-2xl font-bold">Заказы</h1>
        <LiveOrders initialStamp={stamp.stamp} initialPending={stamp.pending} />
      </div>

      <div className="flex gap-2 overflow-x-auto">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/admin/orders?tab=${t.key}`}
            className={cn(
              "whitespace-nowrap rounded-full border px-4 py-2 text-sm font-medium",
              tab === t.key
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card hover:bg-secondary"
            )}
          >
            {t.label}
          </Link>
        ))}
      </div>

      <OrdersFilterBar categories={categories} promos={promos} />

      <div className="rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>№</TableHead>
              <TableHead>Дата</TableHead>
              <TableHead>Клиент</TableHead>
              <TableHead>Получение</TableHead>
              <TableHead>Язык</TableHead>
              <TableHead>Сумма</TableHead>
              <TableHead>Статус</TableHead>
              <TableHead className="text-right">Открыть</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((order) => (
              <OrderRowLink key={order.id} href={`/admin/orders/${order.id}`}>
                <TableCell className="font-mono text-xs">
                  <Link href={`/admin/orders/${order.id}`} className="hover:underline">
                    {order.id.slice(-8).toUpperCase()}
                  </Link>
                </TableCell>
                <TableCell>{formatDateTime(order.createdAt)}</TableCell>
                <TableCell>
                  {order.customerName}
                  <div className="text-xs text-muted-foreground">{order.phone}</div>
                </TableCell>
                <TableCell>
                  {FULFILLMENT_LABELS[order.fulfillment]}
                  {order.deliveryZoneName && (
                    <div className="text-xs text-muted-foreground">{order.deliveryZoneName}</div>
                  )}
                </TableCell>
                <TableCell>{isLocale(order.locale) ? LOCALE_SHORT[order.locale] : order.locale}</TableCell>
                <TableCell>{formatMoney(order.total, "admin")}</TableCell>
                <TableCell>
                  <Badge variant="outline" className={ORDER_STATUS_COLORS[order.status]}>
                    {ORDER_STATUS_LABELS[order.status]}
                  </Badge>
                </TableCell>
                <TableCell className="text-right text-primary">Открыть →</TableCell>
              </OrderRowLink>
            ))}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                  Заказы не найдены
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
