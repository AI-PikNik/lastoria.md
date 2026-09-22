/**
 * Согласие на cookies.
 *   "necessary" — только необходимые (язык, корзина, сессия)
 *   "all"       — плюс аналитика
 * Хранится в cookie на 1 год, чтобы баннер не показывался повторно.
 */
export const CONSENT_COOKIE = "ls_consent";
export const CONSENT_MAX_AGE = 60 * 60 * 24 * 365;

export type ConsentValue = "all" | "necessary";

export function parseConsent(value: string | null | undefined): ConsentValue | null {
  return value === "all" || value === "necessary" ? value : null;
}

/** Аналитика разрешена только после явного «Принять все» */
export function analyticsAllowed(consent: ConsentValue | null): boolean {
  return consent === "all";
}

export function readConsentFromCookieString(cookieString: string): ConsentValue | null {
  const match = cookieString
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${CONSENT_COOKIE}=`));
  return parseConsent(match ? decodeURIComponent(match.slice(CONSENT_COOKIE.length + 1)) : null);
}

export function serializeConsentCookie(value: ConsentValue, secure: boolean): string {
  return `${CONSENT_COOKIE}=${value}; Path=/; Max-Age=${CONSENT_MAX_AGE}; SameSite=Lax${secure ? "; Secure" : ""}`;
}
