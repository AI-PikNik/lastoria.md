"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/auth-guard";
import { flattenZodError, settingsSchema } from "@/lib/validation";
import { uploadBrandFile, uploadImage, UploadValidationError } from "@/lib/uploads";
import { revalidatePublicSite } from "@/lib/admin-data";
import type { ActionResult } from "@/lib/action-result";
import type { Prisma } from "@/lib/generated/prisma/client";

const json = (value: unknown) => value as Prisma.InputJsonValue;

export async function updateSettings(raw: unknown): Promise<ActionResult> {
  await requireAdminSession();
  const parsed = settingsSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Проверьте поля формы", fieldErrors: flattenZodError(parsed.error) };
  const d = parsed.data;

  const data = {
    restaurantName: d.restaurantName,
    restaurantPhone: d.restaurantPhone,
    restaurantAddress: d.restaurantAddress,
    restaurantEmail: d.restaurantEmail || null,
    workingHours: json(d.workingHours),
    minOrderAmount: d.minOrderAmount,
    seoTitles: json(d.seoTitles),
    seoDescriptions: json(d.seoDescriptions),
    shortAnswers: json(d.shortAnswers),
    telegramChatId: d.telegramChatId || null,
    emailSenderAddress: d.emailSenderAddress || null,
    logoUrl: d.logoUrl || null,
    faviconUrl: d.faviconUrl || null,
    heroImageUrl: d.heroImageUrl || null,
    geoLat: d.geoLat ?? null,
    geoLng: d.geoLng ?? null,
    cookieBannerEnabled: d.cookieBannerEnabled,
    analyticsId: d.analyticsId || null,
  };
  await prisma.settings.upsert({ where: { id: "main" }, update: data, create: { id: "main", ...data } });

  revalidatePath("/admin/settings");
  revalidatePublicSite();
  return { ok: true };
}

/** Логотип / favicon (JPG, PNG, WEBP, SVG, ICO) или картинка героя главной */
export async function uploadBrandAsset(formData: FormData): Promise<ActionResult> {
  await requireAdminSession();
  const file = formData.get("file");
  const kind = formData.get("kind");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Файл не выбран" };
  try {
    const result = kind === "hero" ? await uploadImage(file, "brand") : await uploadBrandFile(file);
    revalidatePath("/admin/media");
    return { ok: true, url: result.url };
  } catch (error) {
    if (error instanceof UploadValidationError) return { ok: false, error: error.message };
    throw error;
  }
}
