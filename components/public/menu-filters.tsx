"use client";

import * as React from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const FILTER_KEYS = ["spicy", "veg", "alcohol", "promo", "priceMin", "priceMax"] as const;

export function MenuFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [state, setState] = React.useState({
    spicy: searchParams.get("spicy") === "1",
    veg: searchParams.get("veg") === "1",
    alcohol: searchParams.get("alcohol") === "1",
    promo: searchParams.get("promo") === "1",
    priceMin: searchParams.get("priceMin") ?? "",
    priceMax: searchParams.get("priceMax") ?? "",
  });

  const apply = () => {
    const params = new URLSearchParams(searchParams.toString());
    for (const key of FILTER_KEYS) {
      params.delete(key);
    }
    if (state.spicy) params.set("spicy", "1");
    if (state.veg) params.set("veg", "1");
    if (state.alcohol) params.set("alcohol", "1");
    if (state.promo) params.set("promo", "1");
    if (state.priceMin) params.set("priceMin", state.priceMin);
    if (state.priceMax) params.set("priceMax", state.priceMax);
    router.push(`${pathname}?${params.toString()}`);
  };

  const reset = () => {
    setState({ spicy: false, veg: false, alcohol: false, promo: false, priceMin: "", priceMax: "" });
    const params = new URLSearchParams(searchParams.toString());
    for (const key of FILTER_KEYS) params.delete(key);
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4">
      <p className="text-sm font-semibold">Фильтры</p>

      <FilterCheckbox
        id="filter-promo"
        label="Только акционные"
        checked={state.promo}
        onChange={(v) => setState((s) => ({ ...s, promo: v }))}
      />
      <FilterCheckbox
        id="filter-spicy"
        label="Острое"
        checked={state.spicy}
        onChange={(v) => setState((s) => ({ ...s, spicy: v }))}
      />
      <FilterCheckbox
        id="filter-veg"
        label="Вегетарианское"
        checked={state.veg}
        onChange={(v) => setState((s) => ({ ...s, veg: v }))}
      />
      <FilterCheckbox
        id="filter-alcohol"
        label="Алкоголь 18+"
        checked={state.alcohol}
        onChange={(v) => setState((s) => ({ ...s, alcohol: v }))}
      />

      <div>
        <Label className="text-xs text-muted-foreground">Цена, MDL</Label>
        <div className="mt-1 flex items-center gap-2">
          <Input
            type="number"
            min={0}
            placeholder="от"
            value={state.priceMin}
            onChange={(e) => setState((s) => ({ ...s, priceMin: e.target.value }))}
            aria-label="Минимальная цена"
          />
          <span className="text-muted-foreground">—</span>
          <Input
            type="number"
            min={0}
            placeholder="до"
            value={state.priceMax}
            onChange={(e) => setState((s) => ({ ...s, priceMax: e.target.value }))}
            aria-label="Максимальная цена"
          />
        </div>
      </div>

      <div className="flex gap-2">
        <Button size="sm" onClick={apply} className="flex-1">
          Применить
        </Button>
        <Button size="sm" variant="outline" onClick={reset}>
          Сбросить
        </Button>
      </div>
    </div>
  );
}

function FilterCheckbox({
  id,
  label,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <Checkbox id={id} checked={checked} onCheckedChange={(v) => onChange(Boolean(v))} />
      <Label htmlFor={id} className="cursor-pointer font-normal">
        {label}
      </Label>
    </div>
  );
}
