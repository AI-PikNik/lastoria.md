"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-guard";
import { customerEditSchema, flattenZodError } from "@/lib/validation";
import type { ActionResult } from "@/lib/action-result";

/**
 * Отдельной таблицы клиентов нет — клиент определяется по телефону в заказах.
 * Изменение данных применяется ко всем заказам с этим телефоном.
 */
export async function updateCustomer(phone: string, raw: unknown): Promise<ActionResult & { phone?: string }> {
  await requireAdmin();
  const parsed = customerEditSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Проверьте поля", fieldErrors: flattenZodError(parsed.error) };
  const count = await prisma.order.count({ where: { phone } });
  if (count === 0) return { ok: false, error: "Клиент не найден" };

  await prisma.order.updateMany({
    where: { phone },
    data: {
      customerName: parsed.data.customerName,
      phone: parsed.data.phone,
      email: parsed.data.email || null,
    },
  });
  revalidatePath("/admin/customers");
  return { ok: true, phone: parsed.data.phone };
}

/**
 * «Удаление» клиента — обезличивание: из всех его заказов стираются имя,
 * телефон, email, адрес и комментарий (право на удаление персональных данных).
 * Суммы и состав заказов остаются, чтобы не ломать выручку и аналитику.
 */
export async function deleteCustomer(phone: string): Promise<ActionResult> {
  await requireAdmin();
  const active = await prisma.order.count({
    where: { phone, status: { notIn: ["COMPLETED", "CANCELLED"] } },
  });
  if (active > 0) {
    return { ok: false, error: `У клиента ${active} незавершённых заказов — сначала завершите или отмените их.` };
  }
  const orders = await prisma.order.findMany({ where: { phone }, select: { id: true } });
  if (orders.length === 0) return { ok: false, error: "Клиент не найден" };

  await prisma.$transaction(
    orders.map((o) =>
      prisma.order.update({
        where: { id: o.id },
        data: {
          customerName: "Клиент удалён",
          // уникальная заглушка, чтобы обезличенные заказы не склеивались в одного «клиента»
          phone: `deleted-${o.id.slice(-8)}`,
          email: null,
          address: null,
          comment: null,
        },
      })
    )
  );
  revalidatePath("/admin/customers");
  return { ok: true };
}
