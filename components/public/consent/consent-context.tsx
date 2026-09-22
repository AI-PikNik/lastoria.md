"use client";

import * as React from "react";
import {
  CONSENT_COOKIE,
  readConsentFromCookieString,
  serializeConsentCookie,
  type ConsentValue,
} from "@/lib/consent";

interface ConsentContextValue {
  /** undefined — ещё не прочитали cookie (до гидрации), null — выбора нет */
  consent: ConsentValue | null | undefined;
  choose: (value: ConsentValue) => void;
  reset: () => void;
}

const ConsentContext = React.createContext<ConsentContextValue | null>(null);

export function ConsentProvider({ children }: { children: React.ReactNode }) {
  const [consent, setConsent] = React.useState<ConsentValue | null | undefined>(undefined);

  React.useEffect(() => {
    queueMicrotask(() => setConsent(readConsentFromCookieString(document.cookie)));
  }, []);

  const choose = React.useCallback((value: ConsentValue) => {
    document.cookie = serializeConsentCookie(value, window.location.protocol === "https:");
    setConsent(value);
  }, []);

  const reset = React.useCallback(() => {
    document.cookie = `${CONSENT_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
    setConsent(null);
  }, []);

  const value = React.useMemo(() => ({ consent, choose, reset }), [consent, choose, reset]);
  return <ConsentContext.Provider value={value}>{children}</ConsentContext.Provider>;
}

export function useConsent() {
  const ctx = React.useContext(ConsentContext);
  if (!ctx) throw new Error("useConsent должен использоваться внутри ConsentProvider");
  return ctx;
}
