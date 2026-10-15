"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { GRANULARITY_LABELS, type Granularity } from "@/lib/analytics-period";

/** Меняет параметры адреса страницы аналитики, не прокручивая её наверх */
export function useSetParams() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = React.useTransition();
  const set = React.useCallback(
    (patch: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(patch)) {
        if (value === null || value === "") params.delete(key);
        else params.set(key, value);
      }
      startTransition(() => router.push(`${pathname}?${params.toString()}`, { scroll: false }));
    },
    [router, pathname, searchParams]
  );
  return { set, pending };
}

/** Группа кнопок «один из»: выбранная залита цветом */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex flex-wrap gap-1 rounded-lg border-2 border-border-strong bg-card p-1">
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(option.value)}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-semibold transition-colors",
              active ? "bg-primary text-primary-foreground shadow-sm" : "text-foreground hover:bg-surface"
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/** Шаг графика (часы / дни / недели / месяцы) — общий для всех графиков страницы */
export function GranularityToggle({ current, available }: { current: Granularity; available: Granularity[] }) {
  const { set } = useSetParams();
  if (available.length < 2) return null;
  return (
    <Segmented
      label="Шаг графика"
      value={current}
      options={available.map((g) => ({ value: g, label: GRANULARITY_LABELS[g] }))}
      onChange={(g) => set({ group: g })}
    />
  );
}
