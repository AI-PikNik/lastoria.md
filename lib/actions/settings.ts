"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/auth-guard";
import { settingsSchema } from "@/lib/validation";
import type { Prisma } from "@/lib/generated/prisma/client";

export interface ActionResult {
  ok: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
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

function flatten(error: import("zod").ZodError): Record<string, string> {
  const result: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path[0]?.toString() ?? "form";
    if (!result[key]) result[key] = issue.message;
  }
  return result;
}

export async function updateSettings(formData: FormData): Promise<ActionResult> {
  await requireAdminSession();

  const parsed = settingsSchema.safeParse({
    restaurantName: formData.get("restaurantName"),
    restaurantPhone: formData.get("restaurantPhone"),
    restaurantAddress: formData.get("restaurantAddress"),
    restaurantEmail: formData.get("restaurantEmail") || "",
    workingHours: formData.get("workingHours"),
    minOrderAmount: formData.get("minOrderAmount"),
    seoDefaultTitle: formData.get("seoDefaultTitle"),
    seoDefaultDescription: formData.get("seoDefaultDescription"),
    telegramChatId: formData.get("telegramChatId") || "",
    emailSenderAddress: formData.get("emailSenderAddress") || "",
    deliveryZones: safeJsonArray(formData.get("deliveryZones")),
  });

  if (!parsed.success) {
    return { ok: false, error: "Проверьте поля формы", fieldErrors: flatten(parsed.error) };
  }

  await prisma.settings.upsert({
    where: { id: "main" },
    update: {
      ...parsed.data,
      restaurantEmail: parsed.data.restaurantEmail || null,
      telegramChatId: parsed.data.telegramChatId || null,
      emailSenderAddress: parsed.data.emailSenderAddress || null,
      deliveryZones: parsed.data.deliveryZones as unknown as Prisma.InputJsonValue,
    },
    create: {
      id: "main",
      ...parsed.data,
      restaurantEmail: parsed.data.restaurantEmail || null,
      telegramChatId: parsed.data.telegramChatId || null,
      emailSenderAddress: parsed.data.emailSenderAddress || null,
      deliveryZones: parsed.data.deliveryZones as unknown as Prisma.InputJsonValue,
    },
  });

  revalidatePath("/admin/settings");
  revalidatePath("/", "layout");
  return { ok: true };
}
