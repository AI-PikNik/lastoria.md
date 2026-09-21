"use client";

import * as React from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { PeriodKey } from "@/lib/analytics";

const OPTIONS: { key: PeriodKey; label: string }[] = [
  { key: "today", label: "Сегодня" },
  { key: "7d", label: "7 дней" },
  { key: "30d", label: "30 дней" },
  { key: "this_month", label: "Этот месяц" },
  { key: "last_month", label: "Прошлый месяц" },
  { key: "this_year", label: "Этот год" },
  { key: "custom", label: "Период" },
];

export function PeriodSelector({ current }: { current: PeriodKey }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [from, setFrom] = React.useState(searchParams.get("dateFrom") ?? "");
  const [to, setTo] = React.useState(searchParams.get("dateTo") ?? "");

  const select = (key: PeriodKey) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("period", key);
    if (key !== "custom") {
      params.delete("dateFrom");
      params.delete("dateTo");
    }
    router.push(`${pathname}?${params.toString()}`);
  };

  const applyCustom = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("period", "custom");
    if (from) params.set("dateFrom", from);
    if (to) params.set("dateTo", to);
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {OPTIONS.map((option) => (
        <button
          key={option.key}
          onClick={() => select(option.key)}
          className={cn(
            "rounded-full border px-3 py-1.5 text-sm font-medium",
            current === option.key
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border bg-card hover:bg-secondary"
          )}
        >
          {option.label}
        </button>
      ))}
      {current === "custom" && (
        <div className="flex items-center gap-2">
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          <span>—</span>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          <Button size="sm" onClick={applyCustom}>Применить</Button>
        </div>
      )}
    </div>
  );
}
