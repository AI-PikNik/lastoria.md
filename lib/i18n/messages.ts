import "server-only";
import ro from "@/messages/ro.json";
import ru from "@/messages/ru.json";
import en from "@/messages/en.json";
import it from "@/messages/it.json";
import { prisma } from "@/lib/prisma";
import { DEFAULT_LOCALE, type AppLocale } from "./locales";
import { applyFlatOverrides, mergeMessages, type MessageTree } from "./messages-utils";

export const BASE_MESSAGES: Record<AppLocale, MessageTree> = { ro, ru, en, it };

const CACHE_TTL_MS = 60_000;
let cache: { loadedAt: number; data: Record<AppLocale, Record<string, string>> } | null = null;

async function loadOverrides(): Promise<Record<AppLocale, Record<string, string>>> {
  if (cache && Date.now() - cache.loadedAt < CACHE_TTL_MS) return cache.data;
  const data: Record<AppLocale, Record<string, string>> = { ro: {}, ru: {}, en: {}, it: {} };
  try {
    const rows = await prisma.uiTranslation.findMany();
    for (const row of rows) data[row.locale as AppLocale][row.key] = row.value;
  } catch {
    // БД недоступна — работаем на базовых словарях
  }
  cache = { loadedAt: Date.now(), data };
  return data;
}

export function invalidateMessagesCache() {
  cache = null;
}

/**
 * Итоговые сообщения локали: румынский словарь как подложка (для пропусков),
 * поверх — словарь языка, поверх — правки из админки.
 */
export async function getMessagesFor(locale: AppLocale): Promise<MessageTree> {
  const overrides = await loadOverrides();
  const withDefault =
    locale === DEFAULT_LOCALE
      ? BASE_MESSAGES[DEFAULT_LOCALE]
      : mergeMessages(BASE_MESSAGES[DEFAULT_LOCALE], BASE_MESSAGES[locale]);
  const withDefaultOverrides =
    locale === DEFAULT_LOCALE ? withDefault : applyFlatOverrides(withDefault, overrides[DEFAULT_LOCALE]);
  return applyFlatOverrides(withDefaultOverrides, overrides[locale]);
}

export async function getUiOverrides() {
  return loadOverrides();
}
