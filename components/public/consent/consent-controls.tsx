"use client";

import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Check } from "lucide-react";
import type { ConsentValue } from "@/lib/consent";
import { cn } from "@/lib/utils";
import { useConsent } from "./consent-context";

/**
 * Кнопки «Только необходимые» / «Принять все» на странице /cookies.
 * Сохранённый вариант закрашен и отмечен галочкой.
 */
export function ConsentControls() {
  const t = useTranslations("cookies");
  const { consent, choose } = useConsent();

  const options: { value: ConsentValue; label: string; hint: string }[] = [
    { value: "necessary", label: t("necessary"), hint: t("necessaryHint") },
    { value: "all", label: t("accept"), hint: t("allHint") },
  ];

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        {options.map((option) => {
          const selected = consent === option.value;
          return (
            <div key={option.value} className="space-y-1.5">
              <button
                type="button"
                aria-pressed={selected}
                onClick={() => {
                  choose(option.value);
                  toast.success(t("saved"));
                }}
                className={cn(
                  "flex h-12 w-full items-center justify-center gap-2 rounded-lg border-2 px-4 font-semibold shadow-sm transition-colors",
                  selected
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-primary bg-white text-primary hover:bg-primary/10"
                )}
              >
                {selected && <Check className="size-5" strokeWidth={3} aria-hidden="true" />}
                {option.label}
              </button>
              <p className="px-1 text-sm text-muted-foreground">{option.hint}</p>
            </div>
          );
        })}
      </div>
      <p className="text-sm text-muted-foreground">
        {t("current")}:{" "}
        <strong className="text-foreground">
          {consent === "all" ? t("stateAll") : consent === "necessary" ? t("stateNecessary") : t("stateNone")}
        </strong>
      </p>
    </div>
  );
}
