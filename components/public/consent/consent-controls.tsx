"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { useConsent } from "./consent-context";

/** Кнопки на странице /cookies — изменить сделанный выбор */
export function ConsentControls() {
  const t = useTranslations("cookies");
  const { consent, choose } = useConsent();
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <p className="text-sm text-muted-foreground">
        {t("current")}:{" "}
        <strong className="text-foreground">
          {consent === "all" ? t("stateAll") : consent === "necessary" ? t("stateNecessary") : t("stateNone")}
        </strong>
      </p>
      <div className="flex gap-2">
        <Button variant="outline" className="h-11" onClick={() => choose("necessary")}>
          {t("necessary")}
        </Button>
        <Button className="h-11" onClick={() => choose("all")}>
          {t("accept")}
        </Button>
      </div>
    </div>
  );
}
