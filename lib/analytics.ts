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
import { CATEGORY_KIND_LABELS, REVENUE_STATUSES } from "@/lib/constants";
import { analyticsTypeKey, seriesSpec, type SeriesKind, type SoldRow } from "@/lib/analytics-sales";
import { adminName } from "@/lib/admin-data";
import type { OrderStatus } from "@/lib/generated/prisma/client";

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

export interface SeriesOption {
  spec: string;
  label: string;
  kind: SeriesKind;
  /** Заголовок раздела в списке выбора (группа товара) */
  group: string;
}

/** Что можно вывести на график: все товары, группы и типы групп для аналитики */
export async function getSeriesOptions(): Promise<SeriesOption[]> {
  const categories = await prisma.category.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    include: {
      translations: true,
      products: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }], include: { translations: true } },
    },
  });
  const options: SeriesOption[] = [];
  const types = new Map<string, string>();
  for (const category of categories) {
    const name = adminName(category.translations, category.slug);
    const typeKey = analyticsTypeKey(category.kind, category.analyticsLabel, name);
    if (!types.has(typeKey)) {
      types.set(typeKey, category.kind === "CUSTOM" ? typeKey.slice("custom:".length) : CATEGORY_KIND_LABELS[category.kind]);
    }
    options.push({ spec: seriesSpec("category", category.id), label: name, kind: "category", group: "Группы товаров" });
    for (const product of category.products) {
      options.push({
        spec: seriesSpec("product", product.id),
        label: adminName(product.translations, product.slug),
        kind: "product",
        group: name,
      });
    }
  }
  for (const [key, label] of types) {
    options.push({ spec: seriesSpec("type", key), label, kind: "type", group: "Типы групп" });
  }
  return options;
}

/** Все проданные позиции за период (подтверждённые заказы) — основа разбивок и графиков */
export async function getSoldRows(range: PeriodRange): Promise<SoldRow[]> {
  const items = await prisma.orderItem.findMany({
    where: { order: { createdAt: { gte: range.from, lte: range.to }, status: { in: REVENUE_STATUSES } } },
    select: {
      orderId: true,
      productId: true,
      nameSnapshot: true,
      qty: true,
      lineTotal: true,
      order: { select: { createdAt: true } },
      product: {
        select: {
          slug: true,
          translations: { select: { locale: true, name: true } },
          category: {
            select: {
              id: true,
              slug: true,
              kind: true,
              analyticsLabel: true,
              translations: { select: { locale: true, name: true } },
            },
          },
        },
      },
    },
  });
  return items.map((item) => {
    const category = item.product?.category ?? null;
    const categoryName = category ? adminName(category.translations, category.slug) : "Удалённые товары";
    const typeKey = category ? analyticsTypeKey(category.kind, category.analyticsLabel, categoryName) : "kind:OTHER";
    const typeLabel = !category
      ? CATEGORY_KIND_LABELS.OTHER
      : category.kind === "CUSTOM"
        ? typeKey.slice("custom:".length)
        : CATEGORY_KIND_LABELS[category.kind];
    return {
      orderId: item.orderId,
      createdAt: item.order.createdAt,
      productId: item.productId,
      productName: item.product ? adminName(item.product.translations, item.nameSnapshot) : item.nameSnapshot,
      categoryId: category?.id ?? null,
      categoryName,
      typeKey,
      typeLabel,
      qty: item.qty,
      revenue: toNumber(item.lineTotal),
    };
  });
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
