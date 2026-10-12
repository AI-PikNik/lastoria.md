"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/auth-guard";
import { notifyOrderEdited, notifyOrderStatusChange } from "@/lib/notifications";
import { flattenZodError, orderEditSchema } from "@/lib/validation";
import { orderTotals, recalcOrderLines } from "@/lib/order-edit";
import { parseVariants } from "@/lib/variants";
import { pickLocalized, pickTranslation } from "@/lib/i18n/translate";
import { isLocale } from "@/lib/i18n/locales";
import { toNumber } from "@/lib/format";
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
  await requireStaff();

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
  await requireStaff();
  const order = await prisma.order.findUnique({ where: { id } });
  if (!order) return { ok: false, error: "Заказ не найден" };
  const next = NEXT_ORDER_STATUS[order.status];
  if (!next) return { ok: false, error: "Нет следующего статуса" };
  return transitionOrder(id, next);
}

/**
 * «Отпечаток» списка заказов для автообновления админки: меняется при
 * появлении нового заказа или изменении любого существующего.
 */
export async function getOrdersStamp(): Promise<{ stamp: string; pending: number }> {
  await requireStaff();
  const [agg, pending] = await Promise.all([
    prisma.order.aggregate({ _count: true, _max: { updatedAt: true } }),
    prisma.order.count({ where: { status: "PENDING_CONFIRMATION" } }),
  ]);
  return { stamp: `${agg._count}:${agg._max.updatedAt?.toISOString() ?? ""}`, pending };
}

/**
 * Изменить состав и данные заказа (клиент позвонил и что-то добавил/убрал).
 * Доступно администратору и оператору, пока заказ не завершён и не отменён.
 */
export async function updateOrderContent(id: string, raw: unknown): Promise<ActionResult & { fieldErrors?: Record<string, string> }> {
  const staff = await requireStaff();
  const parsed = orderEditSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Проверьте поля", fieldErrors: flattenZodError(parsed.error) };
  const input = parsed.data;

  const order = await prisma.order.findUnique({ where: { id }, include: { items: true } });
  if (!order) return { ok: false, error: "Заказ не найден" };
  if (TERMINAL_STATUSES.includes(order.status)) return { ok: false, error: "Завершённый или отменённый заказ изменить нельзя" };
  if (input.fulfillment === "DELIVERY" && (input.address ?? "").length < 4) {
    return { ok: false, error: "Укажите адрес доставки", fieldErrors: { address: "Укажите адрес доставки" } };
  }

  // Новые позиции: цена и название из каталога на языке заказа
  const newInputs = input.items.filter((i) => !i.id);
  const products = newInputs.length
    ? await prisma.product.findMany({
        where: { id: { in: newInputs.map((i) => i.productId ?? "") } },
        include: { translations: true },
      })
    : [];
  const productMap = new Map(products.map((p) => [p.id, p]));
  const orderLocale = isLocale(order.locale) ? order.locale : "ro";

  const newMeta: { productId: string; name: string; variant: { key: string; name: string } | null; unitPrice: number }[] = [];
  for (const item of newInputs) {
    const product = productMap.get(item.productId ?? "");
    if (!product) return { ok: false, error: "Товар не найден — обновите страницу" };
    const variants = parseVariants(product.variants);
    const variant = item.variantKey ? variants.find((v) => v.key === item.variantKey) : variants[0];
    if (variants.length > 0 && !variant) return { ok: false, error: "Выберите вариант товара" };
    newMeta.push({
      productId: product.id,
      name: pickTranslation(product.translations, orderLocale, ["name"] as const).values.name || product.slug,
      variant: variant ? { key: variant.key, name: pickLocalized(variant.names, orderLocale, variant.key) } : null,
      unitPrice: Math.max(toNumber(product.price) + (variant?.priceDelta ?? 0), 0),
    });
  }

  const existing = order.items.map((i) => ({ id: i.id, qty: i.qty, unitPrice: toNumber(i.unitPrice), lineTotal: toNumber(i.lineTotal) }));
  const known = new Set(existing.map((e) => e.id));
  if (input.items.some((i) => i.id && !known.has(i.id))) return { ok: false, error: "Заказ уже изменён — обновите страницу" };

  let newIndex = 0;
  const lines = recalcOrderLines(
    existing,
    input.items.map((i) => (i.id ? { id: i.id, qty: i.qty } : { qty: i.qty, unitPrice: newMeta[newIndex++].unitPrice }))
  );
  const totals = orderTotals(lines, input.fulfillment === "DELIVERY" ? input.deliveryFee : 0);

  const keptIds = new Set(lines.filter((l) => l.id).map((l) => l.id!));
  const removed = order.items.filter((i) => !keptIds.has(i.id));
  const changes: string[] = [];
  for (const r of removed) changes.push(`убрано: ${r.nameSnapshot} × ${r.qty}`);
  for (const l of lines) {
    const old = order.items.find((i) => i.id === l.id);
    if (old && old.qty !== l.qty) changes.push(`${old.nameSnapshot}: ${old.qty} → ${l.qty}`);
  }
  newMeta.forEach((m, i) => {
    const qty = lines.filter((l) => !l.id)[i].qty;
    changes.push(`добавлено: ${m.name}${m.variant ? ` (${m.variant.name})` : ""} × ${qty}`);
  });
  if (toNumber(order.total) !== totals.total) changes.push(`сумма: ${toNumber(order.total)} → ${totals.total} MDL`);
  const note = [`Изменено: ${staff.name}`, ...changes, input.note || ""].filter(Boolean).join("; ").slice(0, 1000);

  let m = 0;
  const updated = await prisma.$transaction(async (tx) => {
    if (removed.length) await tx.orderItem.deleteMany({ where: { id: { in: removed.map((r) => r.id) } } });
    for (const line of lines) {
      if (line.id) {
        await tx.orderItem.update({ where: { id: line.id }, data: { qty: line.qty, lineTotal: line.lineTotal } });
      } else {
        const meta = newMeta[m++];
        await tx.orderItem.create({
          data: {
            orderId: id,
            productId: meta.productId,
            nameSnapshot: meta.name,
            variantSnapshot: meta.variant ?? undefined,
            qty: line.qty,
            unitPrice: line.unitPrice,
            lineTotal: line.lineTotal,
          },
        });
      }
    }
    return tx.order.update({
      where: { id },
      data: {
        customerName: input.customerName,
        phone: input.phone,
        email: input.email || null,
        fulfillment: input.fulfillment,
        address: input.fulfillment === "DELIVERY" ? input.address || null : null,
        comment: input.comment || null,
        paymentMethod: input.paymentMethod,
        subtotal: totals.subtotal,
        discountTotal: totals.discountTotal,
        deliveryFee: totals.deliveryFee,
        total: totals.total,
        events: { create: { fromStatus: order.status, toStatus: order.status, actor: "ADMIN", note } },
      },
      include: { items: true },
    });
  });

  await notifyOrderEdited(updated, staff.name);
  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${id}`);
  return { ok: true };
}
