"use client";

import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Check } from "lucide-react";
import type { ConsentValue } from "@/lib/consent";
import { cn } from "@/lib/utils";
import { useConsent } from "./consent-context";

/**
 * Выбор на странице /cookies — переключатель: подсвечен именно сохранённый
 * вариант (раньше «Принять все» всегда выглядел выбранным).
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
      <div role="radiogroup" aria-label={t("title")} className="grid gap-2 sm:grid-cols-2">
        {options.map((option) => {
          const selected = consent === option.value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => {
                choose(option.value);
                toast.success(t("saved"));
              }}
              className={cn(
                "flex min-h-14 items-start gap-3 rounded-lg border p-3 text-left transition-colors",
                selected
                  ? "border-primary bg-primary/10 ring-2 ring-primary/40"
                  : "border-border-strong bg-card hover:bg-surface"
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border",
                  selected ? "border-primary bg-primary text-primary-foreground" : "border-input bg-background"
                )}
              >
                {selected && <Check className="size-3.5" />}
              </span>
              <span>
                <span className="block font-semibold">{option.label}</span>
                <span className="block text-sm text-muted-foreground">{option.hint}</span>
              </span>
            </button>
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
