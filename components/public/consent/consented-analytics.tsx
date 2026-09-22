"use client";

import Script from "next/script";
import { analyticsAllowed } from "@/lib/consent";
import { useConsent } from "./consent-context";

/** Google Analytics подключается только после согласия «Принять все». */
export function ConsentedAnalytics({ analyticsId }: { analyticsId: string | null }) {
  const { consent } = useConsent();
  if (!analyticsId || !analyticsAllowed(consent ?? null)) return null;

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(analyticsId)}`}
        strategy="afterInteractive"
      />
      <Script id="ga-init" strategy="afterInteractive">
        {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config',${JSON.stringify(analyticsId)},{anonymize_ip:true});`}
      </Script>
    </>
  );
}
