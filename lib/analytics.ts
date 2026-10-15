import "server-only";
import { prisma } from "@/lib/prisma";
import {
  bucketKey,
  buildBuckets,
  chisinauDays,
  chisinauToday,
  chisinauWall,
  type Granularity,
} from "@/lib/analytics-period";
import { toNumber } from "@/lib/format";
import { REVENUE_STATUSES } from "@/lib/constants";
import { adminName } from "@/lib/admin-data";
import type { CategoryKind, OrderStatus } from "@/lib/generated/prisma/client";

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

/** Границы периода — по календарю Кишинёва, независимо от часового пояса сервера */
export function resolvePeriod(
  key: PeriodKey,
  customFrom?: string | null,
  customTo?: string | null,
  now: Date = new Date()
): PeriodRange {
  const wall = chisinauWall(now);
  const y = wall.getUTCFullYear();
  const m = wall.getUTCMonth();
  const d = wall.getUTCDate();
  const parse = (value?: string | null): [number, number, number] | null => {
    const match = value?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return match ? [Number(match[1]), Number(match[2]) - 1, Number(match[3])] : null;
  };
  switch (key) {
    case "today":
      return chisinauToday(now);
    case "7d":
      return chisinauDays([y, m, d - 6], [y, m, d + 1]);
    case "30d":
      return chisinauDays([y, m, d - 29], [y, m, d + 1]);
    case "last_month":
      return chisinauDays([y, m - 1, 1], [y, m, 1]);
    case "this_year":
      return chisinauDays([y, 0, 1], [y + 1, 0, 1]);
    case "custom": {
      const from = parse(customFrom) ?? [y, m, 1];
      const to = parse(customTo) ?? [y, m, d];
      return chisinauDays(from, [to[0], to[1], to[2] + 1]);
    }
    case "this_month":
    default:
      return chisinauDays([y, m, 1], [y, m + 1, 1]);
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
  key: string;
  label: string;
  revenue: number;
  ordersCount: number;
  /** Средний чек в корзине (0, если заказов не было) */
  avgCheck: number;
}

export async function getSalesOverTime(range: PeriodRange, granularity: Granularity): Promise<SalesPoint[]> {
  const orders = await prisma.order.findMany({
    where: {
      createdAt: { gte: range.from, lte: range.to },
      status: { in: REVENUE_STATUSES },
    },
    select: { createdAt: true, total: true },
  });

  const buckets = new Map<string, { revenue: number; ordersCount: number }>();
  for (const order of orders) {
    const key = bucketKey(order.createdAt, granularity);
    const current = buckets.get(key) ?? { revenue: 0, ordersCount: 0 };
    current.revenue += toNumber(order.total);
    current.ordersCount += 1;
    buckets.set(key, current);
  }

  return buildBuckets(range, granularity).map(({ key, label }) => {
    const b = buckets.get(key) ?? { revenue: 0, ordersCount: 0 };
    return { key, label, ...b, avgCheck: b.ordersCount > 0 ? Math.round(b.revenue / b.ordersCount) : 0 };
  });
}

export interface ProductOption {
  id: string;
  name: string;
  group: string;
}

/** Все товары для выбора на графике «Товар во времени» */
export async function getProductOptions(): Promise<ProductOption[]> {
  const rows = await prisma.product.findMany({
    include: { translations: true, category: { include: { translations: true } } },
  });
  return rows
    .map((p) => ({
      id: p.id,
      name: adminName(p.translations, p.slug),
      group: adminName(p.category.translations, p.category.slug),
    }))
    .sort((a, b) => a.group.localeCompare(b.group, "ru") || a.name.localeCompare(b.name, "ru"));
}

export interface ProductTrend {
  /** Выбранные товары с итогами за период */
  products: { id: string; name: string; qty: number; revenue: number }[];
  /** Точки графика: q:<id> — штук, r:<id> — выручка */
  points: ({ key: string; label: string } & Record<string, number | string>)[];
}

/** Продажи выбранных товаров во времени (штуки и выручка по корзинам) */
export async function getProductTrend(
  range: PeriodRange,
  granularity: Granularity,
  products: { id: string; name: string }[]
): Promise<ProductTrend> {
  const ids = products.map((p) => p.id);
  const items = ids.length
    ? await prisma.orderItem.findMany({
        where: {
          productId: { in: ids },
          order: { createdAt: { gte: range.from, lte: range.to }, status: { in: REVENUE_STATUSES } },
        },
        select: { productId: true, qty: true, lineTotal: true, order: { select: { createdAt: true } } },
      })
    : [];

  const cells = new Map<string, { qty: number; revenue: number }>();
  const totals = new Map<string, { qty: number; revenue: number }>();
  for (const item of items) {
    if (!item.productId) continue;
    const revenue = toNumber(item.lineTotal);
    const cellKey = `${bucketKey(item.order.createdAt, granularity)}|${item.productId}`;
    const cell = cells.get(cellKey) ?? { qty: 0, revenue: 0 };
    cell.qty += item.qty;
    cell.revenue += revenue;
    cells.set(cellKey, cell);
    const total = totals.get(item.productId) ?? { qty: 0, revenue: 0 };
    total.qty += item.qty;
    total.revenue += revenue;
    totals.set(item.productId, total);
  }

  return {
    products: products.map((p) => ({ ...p, ...(totals.get(p.id) ?? { qty: 0, revenue: 0 }) })),
    points: buildBuckets(range, granularity).map(({ key, label }) => {
      const point: { key: string; label: string } & Record<string, number | string> = { key, label };
      for (const id of ids) {
        const cell = cells.get(`${key}|${id}`);
        point[`q:${id}`] = cell?.qty ?? 0;
        point[`r:${id}`] = cell?.revenue ?? 0;
      }
      return point;
    }),
  };
}

export interface TypeBreakdown {
  /** Тип группы (пицца, напитки, алкоголь…) */
  type: CategoryKind;
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
    include: { product: { include: { category: { include: { translations: true } } } } },
  });

  const byType = new Map<CategoryKind, TypeBreakdown>();
  const byCategory = new Map<string, CategoryBreakdown>();

  for (const item of items) {
    const revenue = toNumber(item.lineTotal);
    if (item.product) {
      const type = item.product.category.kind;
      const typeEntry = byType.get(type) ?? { type, revenue: 0, qty: 0 };
      typeEntry.revenue += revenue;
      typeEntry.qty += item.qty;
      byType.set(type, typeEntry);

      const category = item.product.category;
      const catEntry = byCategory.get(category.id) ?? {
        categoryId: category.id,
        categoryName: adminName(category.translations, category.slug),
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
