/**
 * Чистые расчёты аналитики продаж (без базы — покрыты тестами).
 * Строки продаж приходят из lib/analytics.ts (getSoldRows).
 */
import { bucketKey, type Granularity } from "@/lib/analytics-period";

/** Сколько линий можно сравнить на одном графике (столько цветов различимы) */
export const MAX_SERIES = 6;

export interface SoldRow {
  orderId: string;
  createdAt: Date;
  productId: string | null;
  productName: string;
  categoryId: string | null;
  categoryName: string;
  /** Тип для аналитики: kind:PIZZA … или custom:<своя группа> */
  typeKey: string;
  typeLabel: string;
  qty: number;
  revenue: number;
}

export type SeriesKind = "product" | "category" | "type";

const PREFIX: Record<SeriesKind, string> = { product: "p", category: "c", type: "t" };

/** Серия на графике: p:<товар>, c:<группа>, t:<тип> */
export function seriesSpec(kind: SeriesKind, id: string): string {
  return `${PREFIX[kind]}:${id}`;
}

export function parseSeriesSpec(spec: string): { kind: SeriesKind; id: string } | null {
  const match = /^([pct]):(.+)$/.exec(spec);
  if (!match) return null;
  const kind = (Object.keys(PREFIX) as SeriesKind[]).find((k) => PREFIX[k] === match[1])!;
  return { kind, id: match[2] };
}

/** Ключ типа группы для аналитики: стандартный тип или своя группа */
export function analyticsTypeKey(kind: string, analyticsLabel: string | null, categoryName: string): string {
  return kind === "CUSTOM" ? `custom:${(analyticsLabel || categoryName).trim()}` : `kind:${kind}`;
}

function matches(row: SoldRow, spec: { kind: SeriesKind; id: string }): boolean {
  if (spec.kind === "product") return row.productId === spec.id;
  if (spec.kind === "category") return row.categoryId === spec.id;
  return row.typeKey === spec.id;
}

export interface ProductSummary {
  spec: string | null;
  name: string;
  categoryId: string | null;
  typeKey: string;
  qty: number;
  revenue: number;
  orders: number;
}

export interface BreakdownRow {
  spec: string;
  label: string;
  qty: number;
  revenue: number;
  orders: number;
  /** Доля выручки за период, 0…1 */
  share: number;
  /** Товары внутри, по убыванию выручки */
  products: ProductSummary[];
}

export interface SalesSummary {
  totalRevenue: number;
  totalQty: number;
  byType: BreakdownRow[];
  byCategory: BreakdownRow[];
  products: ProductSummary[];
}

/** Итоги по типам, группам и товарам за период */
export function summarizeSales(rows: SoldRow[]): SalesSummary {
  const products = new Map<string, ProductSummary & { orderIds: Set<string> }>();
  for (const row of rows) {
    const key = row.productId ?? `name:${row.productName}`;
    const entry = products.get(key) ?? {
      spec: row.productId ? seriesSpec("product", row.productId) : null,
      name: row.productName,
      categoryId: row.categoryId,
      typeKey: row.typeKey,
      qty: 0,
      revenue: 0,
      orders: 0,
      orderIds: new Set<string>(),
    };
    entry.qty += row.qty;
    entry.revenue += row.revenue;
    entry.orderIds.add(row.orderId);
    products.set(key, entry);
  }
  const productList: ProductSummary[] = [...products.values()]
    .map(({ orderIds, ...p }) => ({ ...p, orders: orderIds.size }))
    .sort((a, b) => b.revenue - a.revenue);

  const totalRevenue = rows.reduce((sum, r) => sum + r.revenue, 0);
  const totalQty = rows.reduce((sum, r) => sum + r.qty, 0);

  const group = (keyOf: (r: SoldRow) => string, labelOf: (r: SoldRow) => string, kind: SeriesKind, pick: (p: ProductSummary) => string) => {
    const map = new Map<string, { label: string; qty: number; revenue: number; orderIds: Set<string> }>();
    for (const row of rows) {
      const key = keyOf(row);
      const entry = map.get(key) ?? { label: labelOf(row), qty: 0, revenue: 0, orderIds: new Set<string>() };
      entry.qty += row.qty;
      entry.revenue += row.revenue;
      entry.orderIds.add(row.orderId);
      map.set(key, entry);
    }
    return [...map.entries()]
      .map(([key, e]) => ({
        spec: seriesSpec(kind, key),
        label: e.label,
        qty: e.qty,
        revenue: e.revenue,
        orders: e.orderIds.size,
        share: totalRevenue > 0 ? e.revenue / totalRevenue : 0,
        products: productList.filter((p) => pick(p) === key),
      }))
      .sort((a, b) => b.revenue - a.revenue);
  };

  return {
    totalRevenue,
    totalQty,
    byType: group((r) => r.typeKey, (r) => r.typeLabel, "type", (p) => p.typeKey),
    byCategory: group((r) => r.categoryId ?? "none", (r) => r.categoryName, "category", (p) => p.categoryId ?? "none"),
    products: productList,
  };
}

export interface TrendSeries {
  spec: string;
  label: string;
  qty: number;
  revenue: number;
}

export interface Trend {
  series: TrendSeries[];
  /** q0…qN — штук, r0…rN — выручка по сериям в порядке series */
  points: ({ key: string; label: string } & Record<string, number | string>)[];
}

/** Продажи выбранных серий (товары, группы, типы) по корзинам времени */
export function buildTrend(
  rows: SoldRow[],
  selected: { spec: string; label: string }[],
  buckets: { key: string; label: string }[],
  granularity: Granularity
): Trend {
  const specs = selected
    .map((s) => ({ ...s, parsed: parseSeriesSpec(s.spec) }))
    .filter((s): s is typeof s & { parsed: NonNullable<typeof s.parsed> } => s.parsed !== null)
    .slice(0, MAX_SERIES);
  const cells = new Map<string, { qty: number; revenue: number }>();
  const totals = specs.map(() => ({ qty: 0, revenue: 0 }));
  for (const row of rows) {
    const bucket = bucketKey(row.createdAt, granularity);
    specs.forEach((s, i) => {
      if (!matches(row, s.parsed)) return;
      const cellKey = `${bucket}|${i}`;
      const cell = cells.get(cellKey) ?? { qty: 0, revenue: 0 };
      cell.qty += row.qty;
      cell.revenue += row.revenue;
      cells.set(cellKey, cell);
      totals[i].qty += row.qty;
      totals[i].revenue += row.revenue;
    });
  }
  return {
    series: specs.map((s, i) => ({ spec: s.spec, label: s.label, ...totals[i] })),
    points: buckets.map(({ key, label }) => {
      const point: { key: string; label: string } & Record<string, number | string> = { key, label };
      specs.forEach((_, i) => {
        const cell = cells.get(`${key}|${i}`);
        point[`q${i}`] = cell?.qty ?? 0;
        point[`r${i}`] = Math.round((cell?.revenue ?? 0) * 100) / 100;
      });
      return point;
    }),
  };
}
