"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/auth-guard";
import { faqItemSchema, flattenZodError, locationImageSchema, locationSchema } from "@/lib/validation";
import { revalidatePublicSite } from "@/lib/admin-data";
import type { ActionResult } from "@/lib/action-result";
import type { Prisma } from "@/lib/generated/prisma/client";

const json = (value: unknown) => value as Prisma.InputJsonValue;

function done(path: string): ActionResult {
  revalidatePath(path);
  revalidatePublicSite();
  return { ok: true };
}

/* ── Вопросы-ответы (FAQ) ── */

export async function saveFaqItem(id: string | null, raw: unknown): Promise<ActionResult> {
  await requireAdminSession();
  const parsed = faqItemSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Проверьте поля", fieldErrors: flattenZodError(parsed.error) };
  const data = { question: json(parsed.data.question), answer: json(parsed.data.answer), isActive: parsed.data.isActive };
  if (id) {
    await prisma.faqItem.update({ where: { id }, data });
  } else {
    const last = await prisma.faqItem.aggregate({ _max: { sortOrder: true } });
    await prisma.faqItem.create({ data: { ...data, sortOrder: (last._max.sortOrder ?? 0) + 1 } });
  }
  return done("/admin/faq");
}

export async function setFaqItemActive(id: string, isActive: boolean): Promise<ActionResult> {
  await requireAdminSession();
  await prisma.faqItem.update({ where: { id }, data: { isActive } });
  return done("/admin/faq");
}

export async function deleteFaqItem(id: string): Promise<ActionResult> {
  await requireAdminSession();
  await prisma.faqItem.delete({ where: { id } });
  return done("/admin/faq");
}

export async function reorderFaqItems(ids: string[]): Promise<ActionResult> {
  await requireAdminSession();
  await prisma.$transaction(ids.map((id, i) => prisma.faqItem.update({ where: { id }, data: { sortOrder: i + 1 } })));
  return done("/admin/faq");
}

/* ── Заведения (страница «О нас») ── */

export async function saveLocation(id: string | null, raw: unknown): Promise<ActionResult> {
  await requireAdminSession();
  const parsed = locationSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Проверьте поля", fieldErrors: flattenZodError(parsed.error) };
  const d = parsed.data;
  const data = {
    name: json(d.name),
    description: json(d.description),
    hours: json(d.hours),
    address: d.address,
    phone: d.phone,
    mapUrl: d.mapUrl,
    isActive: d.isActive,
  };
  let savedId = id;
  if (id) {
    await prisma.location.update({ where: { id }, data });
  } else {
    const last = await prisma.location.aggregate({ _max: { sortOrder: true } });
    savedId = (await prisma.location.create({ data: { ...data, sortOrder: (last._max.sortOrder ?? 0) + 1 } })).id;
  }
  return { ...done("/admin/locations"), id: savedId ?? undefined };
}

export async function setLocationActive(id: string, isActive: boolean): Promise<ActionResult> {
  await requireAdminSession();
  await prisma.location.update({ where: { id }, data: { isActive } });
  return done("/admin/locations");
}

export async function deleteLocation(id: string): Promise<ActionResult> {
  await requireAdminSession();
  await prisma.location.delete({ where: { id } });
  return done("/admin/locations");
}

export async function reorderLocations(ids: string[]): Promise<ActionResult> {
  await requireAdminSession();
  await prisma.$transaction(ids.map((id, i) => prisma.location.update({ where: { id }, data: { sortOrder: i + 1 } })));
  return done("/admin/locations");
}

/* ── Галерея заведения ── */

export async function addLocationImages(locationId: string, urls: string[]): Promise<ActionResult> {
  await requireAdminSession();
  const clean = urls.map((u) => u.trim()).filter(Boolean).slice(0, 50);
  if (clean.length === 0) return { ok: false, error: "Нет фото для добавления" };
  const last = await prisma.locationImage.aggregate({ where: { locationId }, _max: { sortOrder: true } });
  const start = last._max.sortOrder ?? 0;
  await prisma.locationImage.createMany({
    data: clean.map((url, i) => ({ locationId, url, sortOrder: start + i + 1 })),
  });
  return done("/admin/locations");
}

export async function updateLocationImage(id: string, raw: unknown): Promise<ActionResult> {
  await requireAdminSession();
  const parsed = locationImageSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Проверьте поля", fieldErrors: flattenZodError(parsed.error) };
  await prisma.locationImage.update({ where: { id }, data: { url: parsed.data.url, caption: json(parsed.data.caption) } });
  return done("/admin/locations");
}

export async function deleteLocationImage(id: string): Promise<ActionResult> {
  await requireAdminSession();
  await prisma.locationImage.delete({ where: { id } });
  return done("/admin/locations");
}

export async function reorderLocationImages(ids: string[]): Promise<ActionResult> {
  await requireAdminSession();
  await prisma.$transaction(ids.map((id, i) => prisma.locationImage.update({ where: { id }, data: { sortOrder: i + 1 } })));
  return done("/admin/locations");
}
