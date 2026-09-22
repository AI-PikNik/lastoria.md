"use client";

import { useTranslations } from "next-intl";
import { Cookie } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { useConsent } from "./consent-context";

/** Небольшое окно внизу экрана: «Принять» / «Только необходимые» / ссылка на /cookies */
export function CookieBanner() {
  const t = useTranslations("cookies");
  const { consent, choose } = useConsent();
  if (consent !== null) return null;

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label={t("title")}
      className="fixed inset-x-3 bottom-3 z-[60] mx-auto max-w-md rounded-xl border border-border-strong bg-card p-4 shadow-lift sm:left-4 sm:right-auto sm:mx-0 lg:bottom-4"
    >
      <div className="flex items-start gap-3">
        <Cookie className="mt-0.5 size-5 shrink-0 text-accent" aria-hidden="true" />
        <div className="text-sm leading-snug">
          <p className="font-semibold text-foreground">{t("title")}</p>
          <p className="mt-1 text-muted-foreground">
            {t("text")}{" "}
            <Link href="/cookies" className="font-medium text-primary underline underline-offset-2">
              {t("learnMore")}
            </Link>
          </p>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button variant="outline" size="sm" className="h-11" onClick={() => choose("necessary")}>
          {t("necessary")}
        </Button>
        <Button size="sm" className="h-11" onClick={() => choose("all")}>
          {t("accept")}
        </Button>
      </div>
    </div>
  );
}
