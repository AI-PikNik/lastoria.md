"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/auth-guard";
import { promoSchema } from "@/lib/validation";
import type { Prisma } from "@/lib/generated/prisma/client";
import { revalidatePublicSite } from "@/lib/admin-data";

export interface ActionResult {
  ok: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
}

function flatten(error: import("zod").ZodError): Record<string, string> {
  const result: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path[0]?.toString() ?? "form";
    if (!result[key]) result[key] = issue.message;
  }
  return result;
}

function safeJsonArray(value: FormDataEntryValue | null): unknown[] {
  if (typeof value !== "string" || !value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function safeJsonObject(value: FormDataEntryValue | null): Record<string, unknown> {
  if (typeof value !== "string" || !value) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function parsePromoForm(formData: FormData) {
  return promoSchema.safeParse({
    name: formData.get("name"),
    publicNames: safeJsonObject(formData.get("publicNames")),
    code: String(formData.get("code") || "").toUpperCase(),
    type: formData.get("type"),
    value: formData.get("value"),
    scope: formData.get("scope"),
    targetIds: safeJsonArray(formData.get("targetIds")),
    minOrderAmount: formData.get("minOrderAmount") || null,
    startsAt: formData.get("startsAt"),
    endsAt: formData.get("endsAt"),
    isActive: formData.get("isActive") === "on",
    stackable: formData.get("stackable") === "on",
  });
}

export async function createPromo(formData: FormData): Promise<ActionResult> {
  await requireAdminSession();
  const parsed = parsePromoForm(formData);
  if (!parsed.success) {
    return { ok: false, error: "Проверьте поля формы", fieldErrors: flatten(parsed.error) };
  }

  if (parsed.data.code) {
    const existing = await prisma.promo.findUnique({ where: { code: parsed.data.code } });
    if (existing) return { ok: false, fieldErrors: { code: "Такой промокод уже используется" } };
  }

  await prisma.promo.create({
    data: {
      ...parsed.data,
      code: parsed.data.code || null,
      minOrderAmount: parsed.data.minOrderAmount ?? null,
      targetIds: parsed.data.targetIds as unknown as Prisma.InputJsonValue,
      publicNames: parsed.data.publicNames as unknown as Prisma.InputJsonValue,
    },
  });

  revalidatePath("/admin/promos");
  revalidatePublicSite();
  return { ok: true };
}

export async function updatePromo(id: string, formData: FormData): Promise<ActionResult> {
  await requireAdminSession();
  const parsed = parsePromoForm(formData);
  if (!parsed.success) {
    return { ok: false, error: "Проверьте поля формы", fieldErrors: flatten(parsed.error) };
  }

  if (parsed.data.code) {
    const existing = await prisma.promo.findFirst({
      where: { code: parsed.data.code, NOT: { id } },
    });
    if (existing) return { ok: false, fieldErrors: { code: "Такой промокод уже используется" } };
  }

  await prisma.promo.update({
    where: { id },
    data: {
      ...parsed.data,
      code: parsed.data.code || null,
      minOrderAmount: parsed.data.minOrderAmount ?? null,
      targetIds: parsed.data.targetIds as unknown as Prisma.InputJsonValue,
      publicNames: parsed.data.publicNames as unknown as Prisma.InputJsonValue,
    },
  });

  revalidatePath("/admin/promos");
  revalidatePublicSite();
  return { ok: true };
}

export async function togglePromoActive(id: string, isActive: boolean): Promise<ActionResult> {
  await requireAdminSession();
  await prisma.promo.update({ where: { id }, data: { isActive } });
  revalidatePath("/admin/promos");
  revalidatePublicSite();
  return { ok: true };
}

export async function deletePromo(id: string): Promise<ActionResult> {
  await requireAdminSession();
  await prisma.promo.delete({ where: { id } });
  revalidatePath("/admin/promos");
  revalidatePublicSite();
  return { ok: true };
}
