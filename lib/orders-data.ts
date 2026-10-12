import "server-only";
import { prisma } from "@/lib/prisma";

/** Начальное состояние для автообновления (см. components/admin/live-orders.tsx) */
export async function getOrdersStampServer() {
  const [agg, pending] = await Promise.all([
    prisma.order.aggregate({ _count: true, _max: { updatedAt: true } }),
    prisma.order.count({ where: { status: "PENDING_CONFIRMATION" } }),
  ]);
  return { stamp: `${agg._count}:${agg._max.updatedAt?.toISOString() ?? ""}`, pending };
}
