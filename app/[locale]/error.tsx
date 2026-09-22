"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Plaque } from "@/theme/decor";

export default function LocaleError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations("errors");
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex max-w-xl flex-col items-center px-4 py-16 text-center">
      <Plaque className="w-full px-6 py-10">
        <h1 className="font-display text-2xl font-bold text-primary">{t("errorTitle")}</h1>
        <p className="mt-3 text-muted-foreground">{t("errorText")}</p>
        <Button className="mt-6" onClick={() => reset()}>
          {t("retry")}
        </Button>
      </Plaque>
    </div>
  );
}
