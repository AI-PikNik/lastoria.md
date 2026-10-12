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

async function saveOne(key: string, locale: string, value: string) {
  if (!KNOWN_KEYS.has(key) || !isLocale(locale)) throw new Error(`Неизвестный ключ или язык: ${key}/${locale}`);
  const text = String(value ?? "").slice(0, 5000);
  const base = flattenMessages(BASE_MESSAGES[locale])[key] ?? "";
  if (text === base) {
    // совпадает с текстом по умолчанию — правка не нужна
    await prisma.uiTranslation.deleteMany({ where: { key, locale } });
  } else {
    // в том числе пустая строка: так можно скрыть, например, лишний абзац
    await prisma.uiTranslation.upsert({
      where: { key_locale: { key, locale } },
      update: { value: text },
      create: { key, locale, value: text },
    });
  }
}

/**
 * Сохранить текст интерфейса. Значение, совпадающее с базовым словарём,
 * удаляет правку — снова используется текст из messages/*.json.
 * Пустое значение сохраняется как пустое (текст на сайте скрывается).
 */
export async function saveUiTranslation(key: string, locale: string, value: string): Promise<ActionResult> {
  await requireAdminSession();
  try {
    await saveOne(key, locale, value);
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Ошибка" };
  }
  revalidatePath("/admin/translations");
  revalidatePath("/admin/pages", "layout");
  revalidateTranslations();
  return { ok: true };
}

/** Сохранить сразу несколько текстов (редактор «Тексты страниц») */
export async function saveUiTranslations(
  entries: { key: string; locale: string; value: string }[]
): Promise<ActionResult> {
  await requireAdminSession();
  if (!Array.isArray(entries) || entries.length > 500) return { ok: false, error: "Неверные данные" };
  try {
    for (const entry of entries) await saveOne(entry.key, entry.locale, entry.value);
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Ошибка" };
  }
  revalidatePath("/admin/translations");
  revalidatePath("/admin/pages", "layout");
  revalidateTranslations();
  return { ok: true };
}
