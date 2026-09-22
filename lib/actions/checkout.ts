"use server";

import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/lib/generated/prisma/client";
import { checkoutSchema } from "@/lib/validation";
import { resolveCartPricing } from "@/lib/cart-server";
import { isAgeRestricted } from "@/lib/catalog";
import { rateLimit } from "@/lib/rate-limit";
import { notifyNewOrder } from "@/lib/notifications";
import { toNumber } from "@/lib/format";
import { computeDeliveryFee } from "@/lib/delivery";
import { pickLocalized, pickTranslation } from "@/lib/i18n/translate";
import { parseVariants } from "@/lib/variants";

export interface CheckoutActionState {
  ok: boolean;
  /** Ключ словаря (validation.*) для общей ошибки */
  error?: string;
  errorValues?: Record<string, string | number>;
  /** Ключи словаря по полям формы */
  fieldErrors?: Record<string, string>;
  orderToken?: string;
  removedProducts?: boolean;
}

export async function createOrder(rawInput: unknown): Promise<CheckoutActionState> {
  const headerList = await headers();
  const ip =
    headerList.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    headerList.get("x-real-ip") ??
    "unknown";

  const limit = rateLimit(`checkout:${ip}`, 5, 10 * 60 * 1000);
  if (!limit.allowed) return { ok: false, error: "validation.tooMany" };

  const parsed = checkoutSchema.safeParse(rawInput);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0]?.toString() ?? "form";
      if (!fieldErrors[key]) fieldErrors[key] = issue.message.startsWith("validation.") ? issue.message : "validation.checkForm";
    }
    return { ok: false, error: "validation.checkForm", fieldErrors };
  }

  const input = parsed.data;
  const locale = input.locale;

  const { productMap, validItems, result, removedProductIds } = await resolveCartPricing(
    input.items.map((i) => ({ productId: i.productId, variantKey: i.variantKey ?? null, qty: i.qty })),
    input.promoCode
  );

  if (validItems.length === 0) return { ok: false, error: "validation.unavailable" };

  // 18+: проверяем на сервере, клиентскую галочку нельзя обойти
  const hasRestricted = validItems.some((i) => isAgeRestricted(productMap.get(i.productId)!));
  if (hasRestricted && !input.ageConfirmed) {
    return { ok: false, error: "validation.ageRequired", fieldErrors: { ageConfirmed: "validation.ageRequired" } };
  }

  const settings = await prisma.settings.findUnique({ where: { id: "main" } });
  const minOrderAmount = settings ? toNumber(settings.minOrderAmount) : 0;
  if (result.subtotal < minOrderAmount) {
    return { ok: false, error: "validation.minOrder", errorValues: { amount: minOrderAmount } };
  }

  // Доставка: район обязателен, если в админке заведены районы
  let deliveryFee = 0;
  let zoneSnapshot: { id: string; cityName: string; zoneName: string } | null = null;
  if (input.fulfillment === "DELIVERY") {
    const activeZones = await prisma.deliveryZone.count({
      where: { isActive: true, city: { isActive: true } },
    });
    if (activeZones > 0) {
      const zone = input.zoneId
        ? await prisma.deliveryZone.findFirst({
            where: { id: input.zoneId, isActive: true, city: { isActive: true } },
            include: { city: true },
          })
        : null;
      if (!zone) {
        return { ok: false, error: "validation.zoneRequired", fieldErrors: { zoneId: "validation.zoneRequired" } };
      }
      deliveryFee = computeDeliveryFee(
        { fee: toNumber(zone.fee), freeFrom: zone.freeFrom != null ? toNumber(zone.freeFrom) : null },
        result.total
      );
      zoneSnapshot = {
        id: zone.id,
        // В заказе сохраняем названия на русском — их читает оператор
        cityName: pickLocalized(zone.city.names, "ru", zone.city.slug),
        zoneName: pickLocalized(zone.names, "ru", "—"),
      };
    }
  }

  const total = Math.max(result.total + deliveryFee, 0);

  const order = await prisma.order.create({
    data: {
      status: "PENDING_CONFIRMATION",
      fulfillment: input.fulfillment,
      paymentMethod: input.paymentMethod,
      locale,
      customerName: input.customerName,
      phone: input.phone,
      email: input.email || null,
      address: input.fulfillment === "DELIVERY" ? input.address || null : null,
      deliveryZoneId: zoneSnapshot?.id ?? null,
      deliveryCityName: zoneSnapshot?.cityName ?? null,
      deliveryZoneName: zoneSnapshot?.zoneName ?? null,
      comment: input.comment || null,
      ageConfirmed: hasRestricted && input.ageConfirmed,
      subtotal: result.subtotal,
      discountTotal: result.discountTotal,
      deliveryFee,
      total,
      appliedPromos: result.appliedPromos as unknown as Prisma.InputJsonValue,
      items: {
        create: result.items.map((item, index) => {
          const product = productMap.get(item.productId)!;
          const original = validItems[index];
          const variant = parseVariants(product.variants).find((v) => v.key === original.variantKey);
          const { values } = pickTranslation(product.translations, locale, ["name"] as const);
          return {
            productId: item.productId,
            nameSnapshot: values.name || product.slug,
            variantSnapshot: variant
              ? { key: variant.key, name: pickLocalized(variant.names, locale, variant.key) }
              : undefined,
            qty: item.qty,
            unitPrice: item.unitPrice,
            lineTotal: item.lineTotal,
          };
        }),
      },
      events: {
        create: { fromStatus: null, toStatus: "PENDING_CONFIRMATION", actor: "CUSTOMER" },
      },
    },
    include: { items: true },
  });

  await notifyNewOrder(order);

  return {
    ok: true,
    orderToken: order.publicToken,
    removedProducts: removedProductIds.length > 0,
  };
}
