import "server-only";
import {
  startOfDay,
  endOfDay,
  startOfMonth,
  endOfMonth,
  subMonths,
  subDays,
  startOfYear,
  endOfYear,
  format,
  startOfWeek,
  eachDayOfInterval,
} from "date-fns";
import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/format";
import { REVENUE_STATUSES } from "@/lib/constants";
import type { OrderStatus, ProductType } from "@/lib/generated/prisma/client";

export type PeriodKey =
  | "today"
  | "7d"
  | "30d"
  | "this_month"
  | "last_month"
  | "this_year"
  | "custom";

export interface PeriodRange {
  from: Date;
  to: Date;
}

export function resolvePeriod(
  key: PeriodKey,
  customFrom?: string | null,
  customTo?: string | null
): PeriodRange {
  const now = new Date();
  switch (key) {
    case "today":
      return { from: startOfDay(now), to: endOfDay(now) };
    case "7d":
      return { from: startOfDay(subDays(now, 6)), to: endOfDay(now) };
    case "30d":
      return { from: startOfDay(subDays(now, 29)), to: endOfDay(now) };
    case "last_month": {
      const lastMonth = subMonths(now, 1);
      return { from: startOfMonth(lastMonth), to: endOfMonth(lastMonth) };
    }
    case "this_year":
      return { from: startOfYear(now), to: endOfYear(now) };
    case "custom":
      return {
        from: customFrom ? startOfDay(new Date(customFrom)) : startOfMonth(now),
        to: customTo ? endOfDay(new Date(customTo)) : endOfDay(now),
      };
    case "this_month":
    default:
      return { from: startOfMonth(now), to: endOfMonth(now) };
  }
}

export interface DashboardSummary {
  revenue: number;
  ordersCount: number;
  avgOrderValue: number;
  pendingCount: number;
  confirmedCount: number;
  cancelledCount: number;
}

export async function getSummary(range: PeriodRange): Promise<DashboardSummary> {
  const [revenueAgg, pendingCount, cancelledCount] = await Promise.all([
    prisma.order.aggregate({
      where: {
        createdAt: { gte: range.from, lte: range.to },
        status: { in: REVENUE_STATUSES },
      },
      _sum: { total: true },
      _count: true,
    }),
    prisma.order.count({
      where: {
        createdAt: { gte: range.from, lte: range.to },
        status: "PENDING_CONFIRMATION",
      },
    }),
    prisma.order.count({
      where: {
        createdAt: { gte: range.from, lte: range.to },
        status: "CANCELLED",
      },
    }),
  ]);

  const revenue = toNumber(revenueAgg._sum.total ?? 0);
  const confirmedCount = revenueAgg._count;

  return {
    revenue,
    ordersCount: confirmedCount,
    avgOrderValue: confirmedCount > 0 ? revenue / confirmedCount : 0,
    pendingCount,
    confirmedCount,
    cancelledCount,
  };
}

export interface SalesPoint {
  date: string;
  label: string;
  revenue: number;
  ordersCount: number;
}

export async function getSalesOverTime(
  range: PeriodRange,
  granularity: "day" | "week" | "month"
): Promise<SalesPoint[]> {
  const orders = await prisma.order.findMany({
    where: {
      createdAt: { gte: range.from, lte: range.to },
      status: { in: REVENUE_STATUSES },
    },
    select: { createdAt: true, total: true },
  });

  const bucketKey = (date: Date): string => {
    if (granularity === "month") return format(date, "yyyy-MM");
    if (granularity === "week") return format(startOfWeek(date, { weekStartsOn: 1 }), "yyyy-MM-dd");
    return format(date, "yyyy-MM-dd");
  };

  const buckets = new Map<string, { revenue: number; ordersCount: number }>();
  for (const order of orders) {
    const key = bucketKey(order.createdAt);
    const current = buckets.get(key) ?? { revenue: 0, ordersCount: 0 };
    current.revenue += toNumber(order.total);
    current.ordersCount += 1;
    buckets.set(key, current);
  }

  if (granularity === "day") {
    const days = eachDayOfInterval({ start: range.from, end: range.to });
    return days.map((day) => {
      const key = format(day, "yyyy-MM-dd");
      const bucket = buckets.get(key) ?? { revenue: 0, ordersCount: 0 };
      return { date: key, label: format(day, "dd.MM"), ...bucket };
    });
  }

  return Array.from(buckets.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => ({ date: key, label: key, ...value }));
}

export interface TypeBreakdown {
  type: ProductType;
  revenue: number;
  qty: number;
}

export interface CategoryBreakdown {
  categoryId: string;
  categoryName: string;
  revenue: number;
  qty: number;
}

export async function getBreakdown(
  range: PeriodRange
): Promise<{ byType: TypeBreakdown[]; byCategory: CategoryBreakdown[] }> {
  const items = await prisma.orderItem.findMany({
    where: {
      order: {
        createdAt: { gte: range.from, lte: range.to },
        status: { in: REVENUE_STATUSES },
      },
    },
    include: { product: { include: { category: true } } },
  });

  const byType = new Map<ProductType, TypeBreakdown>();
  const byCategory = new Map<string, CategoryBreakdown>();

  for (const item of items) {
    const revenue = toNumber(item.lineTotal);
    if (item.product) {
      const type = item.product.type;
      const typeEntry = byType.get(type) ?? { type, revenue: 0, qty: 0 };
      typeEntry.revenue += revenue;
      typeEntry.qty += item.qty;
      byType.set(type, typeEntry);

      const category = item.product.category;
      const catEntry = byCategory.get(category.id) ?? {
        categoryId: category.id,
        categoryName: category.name,
        revenue: 0,
        qty: 0,
      };
      catEntry.revenue += revenue;
      catEntry.qty += item.qty;
      byCategory.set(category.id, catEntry);
    }
  }

  return {
    byType: Array.from(byType.values()).sort((a, b) => b.revenue - a.revenue),
    byCategory: Array.from(byCategory.values()).sort((a, b) => b.revenue - a.revenue),
  };
}

export interface TopProduct {
  productId: string;
  name: string;
  revenue: number;
  qty: number;
}

export async function getTopProducts(range: PeriodRange, limit = 10): Promise<{
  byRevenue: TopProduct[];
  byQty: TopProduct[];
}> {
  const items = await prisma.orderItem.findMany({
    where: {
      order: {
        createdAt: { gte: range.from, lte: range.to },
        status: { in: REVENUE_STATUSES },
      },
    },
    select: { productId: true, nameSnapshot: true, qty: true, lineTotal: true },
  });

  const map = new Map<string, TopProduct>();
  for (const item of items) {
    const key = item.productId ?? item.nameSnapshot;
    const entry = map.get(key) ?? {
      productId: key,
      name: item.nameSnapshot,
      revenue: 0,
      qty: 0,
    };
    entry.revenue += toNumber(item.lineTotal);
    entry.qty += item.qty;
    map.set(key, entry);
  }

  const all = Array.from(map.values());
  return {
    byRevenue: [...all].sort((a, b) => b.revenue - a.revenue).slice(0, limit),
    byQty: [...all].sort((a, b) => b.qty - a.qty).slice(0, limit),
  };
}

export interface PromoEffectiveness {
  promoId: string;
  name: string;
  ordersCount: number;
  totalDiscount: number;
}

export async function getPromoEffectiveness(range: PeriodRange): Promise<PromoEffectiveness[]> {
  const orders = await prisma.order.findMany({
    where: {
      createdAt: { gte: range.from, lte: range.to },
      status: { in: REVENUE_STATUSES },
      discountTotal: { gt: 0 },
    },
    select: { appliedPromos: true },
  });

  const map = new Map<string, PromoEffectiveness>();
  for (const order of orders) {
    const promos = Array.isArray(order.appliedPromos)
      ? (order.appliedPromos as unknown as {
          id: string;
          name: string;
          discountAmount: number;
        }[])
      : [];
    for (const promo of promos) {
      const entry = map.get(promo.id) ?? {
        promoId: promo.id,
        name: promo.name,
        ordersCount: 0,
        totalDiscount: 0,
      };
      entry.ordersCount += 1;
      entry.totalDiscount += toNumber(promo.discountAmount);
      map.set(promo.id, entry);
    }
  }

  return Array.from(map.values()).sort((a, b) => b.totalDiscount - a.totalDiscount);
}

export const ORDER_STATUS_LIST: OrderStatus[] = [
  "PENDING_CONFIRMATION",
  "CONFIRMED",
  "PREPARING",
  "OUT_FOR_DELIVERY",
  "READY_FOR_PICKUP",
  "COMPLETED",
  "CANCELLED",
];
