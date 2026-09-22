/**
 * Телефоны Молдовы и Приднестровья.
 *
 * Национальный номер — 8 цифр после кода страны +373:
 *   +373 6X XXX XXX / +373 7X XXX XXX — мобильные (Orange, Moldcell, Unite;
 *                                          +373 77X — IDC, Приднестровье)
 *   +373 2X XX XX XX / +373 3X XX XX XX — стационарные (Кишинёв 22, районы;
 *                                          Приднестровье 533, 552, 555, 557, 210, 215, 216, 219)
 *   +373 5X …                          — стационарные Приднестровья (Тирасполь 533 и др.)
 *
 * Внутри страны тот же номер набирают с 0: 069 123 456, 022 123 456, 0533 12345.
 * Принимаем оба варианта (с пробелами, дефисами, скобками) и приводим к +373XXXXXXXX.
 */

const PHONE_RE = /^(?:\+373|00373|0)([235-7]\d{7})$/;

function strip(raw: string): string {
  return raw.replace(/[\s\-().]/g, "");
}

/** Нормализует номер к виду +373XXXXXXXX или возвращает null, если формат не подходит. */
export function normalizeMoldovanPhone(raw: string): string | null {
  const match = PHONE_RE.exec(strip(raw ?? ""));
  return match ? `+373${match[1]}` : null;
}

export function isValidMoldovanPhone(raw: string): boolean {
  return normalizeMoldovanPhone(raw) !== null;
}

/** +37369123456 → +373 69 123 456 (для писем, админки и tel:-ссылок в тексте) */
export function formatMoldovanPhone(normalized: string): string {
  const match = /^\+373(\d{2})(\d{3})(\d{3})$/.exec(normalized);
  return match ? `+373 ${match[1]} ${match[2]} ${match[3]}` : normalized;
}
