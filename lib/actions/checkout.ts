"use server";

import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/lib/generated/prisma/client";
import { checkoutSchema } from "@/lib/validation";
import { resolveCartPricing } from "@/lib/actions/cart-pricing";
import { rateLimit } from "@/lib/rate-limit";
import { notifyNewOrder } from "@/lib/notifications";
import { toNumber } from "@/lib/format";

export interface CheckoutActionState {
  ok: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
  orderToken?: string;
}

export async function createOrder(
  rawInput: unknown
): Promise<CheckoutActionState> {
  const headerList = await headers();
  const ip =
    headerList.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    headerList.get("x-real-ip") ??
    "unknown";

  const limit = rateLimit(`checkout:${ip}`, 5, 10 * 60 * 1000);
  if (!limit.allowed) {
    return {
      ok: false,
      error: "Слишком много попыток оформить заказ. Попробуйте немного позже.",
    };
  }

  const parsed = checkoutSchema.safeParse(rawInput);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0]?.toString() ?? "form";
      if (!fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { ok: false, error: "Проверьте правильность заполнения формы", fieldErrors };
  }

  const input = parsed.data;

  const { validItems, result, removedProductIds } = await resolveCartPricing(
    input.items.map((i) => ({
      productId: i.productId,
      variantName: i.variantName,
      qty: i.qty,
    }))
  );

  if (validItems.length === 0) {
    return {
      ok: false,
      error: "Товары из корзины больше не доступны. Обновите корзину.",
    };
  }

  const settings = await prisma.settings.findUnique({ where: { id: "main" } });
  const minOrderAmount = settings ? toNumber(settings.minOrderAmount) : 0;

  if (result.subtotal < minOrderAmount) {
    return {
      ok: false,
      error: `Минимальная сумма заказа — ${minOrderAmount} MDL`,
    };
  }

  let deliveryFee = 0;
  if (input.fulfillment === "DELIVERY") {
    const zones = Array.isArray(settings?.deliveryZones)
      ? (settings!.deliveryZones as unknown as { name: string; fee: number }[])
      : [];
    const zone = zones.find((z) => z.name === input.deliveryZone);
    deliveryFee = zone ? zone.fee : (zones[0]?.fee ?? 0);
  }

  const total = Math.max(result.total + deliveryFee, 0);

  const products = await prisma.product.findMany({
    where: { id: { in: validItems.map((i) => i.productId) } },
  });
  const productMap = new Map(products.map((p) => [p.id, p]));

  const order = await prisma.order.create({
    data: {
      status: "PENDING_CONFIRMATION",
      fulfillment: input.fulfillment,
      paymentMethod: input.paymentMethod,
      customerName: input.customerName,
      phone: input.phone,
      email: input.email || null,
      address: input.fulfillment === "DELIVERY" ? input.address || null : null,
      comment: input.comment || null,
      subtotal: result.subtotal,
      discountTotal: result.discountTotal,
      deliveryFee,
      total,
      appliedPromos: result.appliedPromos as unknown as Prisma.InputJsonValue,
      items: {
        create: result.items.map((item, index) => {
          const product = productMap.get(item.productId)!;
          const original = validItems[index];
          return {
            productId: item.productId,
            nameSnapshot: product.name,
            variantSnapshot: original?.variantName
              ? { name: original.variantName }
              : undefined,
            qty: item.qty,
            unitPrice: item.unitPrice,
            lineTotal: item.lineTotal,
          };
        }),
      },
      events: {
        create: {
          fromStatus: null,
          toStatus: "PENDING_CONFIRMATION",
          actor: "CUSTOMER",
        },
      },
    },
    include: { items: true },
  });

  await notifyNewOrder(order);

  return {
    ok: true,
    orderToken: order.publicToken,
    ...(removedProductIds.length > 0
      ? { error: "Некоторые товары были удалены из заказа, так как стали недоступны" }
      : {}),
  };
}
