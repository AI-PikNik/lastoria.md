"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/auth-guard";
import { deliveryCitySchema, deliveryZoneSchema, flattenZodError } from "@/lib/validation";
import { revalidatePublicSite } from "@/lib/admin-data";
import type { ActionResult } from "@/lib/action-result";
import type { Prisma } from "@/lib/generated/prisma/client";

const json = (value: unknown) => value as Prisma.InputJsonValue;

function done(): ActionResult {
  revalidatePath("/admin/delivery");
  revalidatePublicSite();
  return { ok: true };
}

/* ── Города ── */

export async function saveCity(id: string | null, raw: unknown): Promise<ActionResult> {
  await requireAdminSession();
  const parsed = deliveryCitySchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Проверьте поля", fieldErrors: flattenZodError(parsed.error) };
  const clash = await prisma.deliveryCity.findFirst({ where: { slug: parsed.data.slug, ...(id ? { NOT: { id } } : {}) } });
  if (clash) return { ok: false, fieldErrors: { slug: "Такой код города уже есть" } };

  const data = { slug: parsed.data.slug, names: json(parsed.data.names), isActive: parsed.data.isActive };
  if (id) {
    await prisma.deliveryCity.update({ where: { id }, data });
  } else {
    const last = await prisma.deliveryCity.aggregate({ _max: { sortOrder: true } });
    await prisma.deliveryCity.create({ data: { ...data, sortOrder: (last._max.sortOrder ?? 0) + 1 } });
  }
  return done();
}

export async function deleteCity(id: string): Promise<ActionResult> {
  await requireAdminSession();
  const zones = await prisma.deliveryZone.count({ where: { cityId: id } });
  if (zones > 0) return { ok: false, error: "Сначала удалите или перенесите районы этого города (или просто скройте город)." };
  await prisma.deliveryCity.delete({ where: { id } });
  return done();
}

export async function reorderCities(ids: string[]): Promise<ActionResult> {
  await requireAdminSession();
  await prisma.$transaction(ids.map((id, i) => prisma.deliveryCity.update({ where: { id }, data: { sortOrder: i + 1 } })));
  return done();
}

/* ── Районы ── */

export async function saveZone(id: string | null, raw: unknown): Promise<ActionResult> {
  await requireAdminSession();
  const parsed = deliveryZoneSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Проверьте поля", fieldErrors: flattenZodError(parsed.error) };
  const data = {
    cityId: parsed.data.cityId,
    names: json(parsed.data.names),
    fee: parsed.data.fee,
    freeFrom: parsed.data.freeFrom ?? null,
    isActive: parsed.data.isActive,
  };
  if (id) {
    await prisma.deliveryZone.update({ where: { id }, data });
  } else {
    const last = await prisma.deliveryZone.aggregate({ where: { cityId: data.cityId }, _max: { sortOrder: true } });
    await prisma.deliveryZone.create({ data: { ...data, sortOrder: (last._max.sortOrder ?? 0) + 1 } });
  }
  return done();
}

/** Район удаляется из списка; в старых заказах название района сохранено отдельно */
export async function deleteZone(id: string): Promise<ActionResult> {
  await requireAdminSession();
  await prisma.$transaction([
    prisma.order.updateMany({ where: { deliveryZoneId: id }, data: { deliveryZoneId: null } }),
    prisma.deliveryZone.delete({ where: { id } }),
  ]);
  return done();
}

export async function reorderZones(ids: string[]): Promise<ActionResult> {
  await requireAdminSession();
  await prisma.$transaction(ids.map((id, i) => prisma.deliveryZone.update({ where: { id }, data: { sortOrder: i + 1 } })));
  return done();
}
