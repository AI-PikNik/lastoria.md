"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/auth-guard";
import { notifyOrderStatusChange } from "@/lib/notifications";
import { NEXT_ORDER_STATUS } from "@/lib/constants";
import type { OrderStatus } from "@/lib/generated/prisma/client";

export interface ActionResult {
  ok: boolean;
  error?: string;
}

const TERMINAL_STATUSES: OrderStatus[] = ["COMPLETED", "CANCELLED"];

async function transitionOrder(
  id: string,
  toStatus: OrderStatus,
  note?: string
): Promise<ActionResult> {
  await requireAdminSession();

  const order = await prisma.order.findUnique({ where: { id } });
  if (!order) return { ok: false, error: "Заказ не найден" };
  if (TERMINAL_STATUSES.includes(order.status)) {
    return { ok: false, error: "Заказ уже завершён или отменён" };
  }

  const updated = await prisma.order.update({
    where: { id },
    data: {
      status: toStatus,
      confirmedAt: toStatus === "CONFIRMED" ? new Date() : order.confirmedAt,
      cancelledAt: toStatus === "CANCELLED" ? new Date() : order.cancelledAt,
      events: {
        create: {
          fromStatus: order.status,
          toStatus,
          actor: "ADMIN",
          note,
        },
      },
    },
    include: { items: true },
  });

  await notifyOrderStatusChange(updated);

  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${id}`);
  revalidatePath(`/order/${order.publicToken}`);

  return { ok: true };
}

export async function confirmOrder(id: string): Promise<ActionResult> {
  return transitionOrder(id, "CONFIRMED");
}

export async function cancelOrder(id: string, note?: string): Promise<ActionResult> {
  return transitionOrder(id, "CANCELLED", note);
}

export async function advanceOrder(id: string): Promise<ActionResult> {
  await requireAdminSession();
  const order = await prisma.order.findUnique({ where: { id } });
  if (!order) return { ok: false, error: "Заказ не найден" };
  const next = NEXT_ORDER_STATUS[order.status];
  if (!next) return { ok: false, error: "Нет следующего статуса" };
  return transitionOrder(id, next);
}
