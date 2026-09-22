"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/auth-guard";
import { BASE_MESSAGES } from "@/lib/i18n/messages";
import { flattenMessages } from "@/lib/i18n/messages-utils";
import { isLocale } from "@/lib/i18n/locales";
import { revalidateTranslations } from "@/lib/admin-data";
import type { ActionResult } from "@/lib/action-result";

const KNOWN_KEYS = new Set(Object.keys(flattenMessages(BASE_MESSAGES.ro)));

/**
 * Сохранить текст интерфейса. Значение, совпадающее с базовым словарём
 * (или пустое), удаляет правку — снова используется текст из messages/*.json.
 */
export async function saveUiTranslation(key: string, locale: string, value: string): Promise<ActionResult> {
  await requireAdminSession();
  if (!KNOWN_KEYS.has(key) || !isLocale(locale)) return { ok: false, error: "Неизвестный ключ или язык" };
  const text = String(value ?? "").slice(0, 5000);
  const base = flattenMessages(BASE_MESSAGES[locale])[key] ?? "";

  if (!text.trim() || text === base) {
    await prisma.uiTranslation.deleteMany({ where: { key, locale } });
  } else {
    await prisma.uiTranslation.upsert({
      where: { key_locale: { key, locale } },
      update: { value: text },
      create: { key, locale, value: text },
    });
  }
  revalidatePath("/admin/translations");
  revalidateTranslations();
  return { ok: true };
}
