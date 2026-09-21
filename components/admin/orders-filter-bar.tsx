"use client";

import * as React from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PRODUCT_TYPE_LABELS } from "@/lib/constants";

interface Category {
  id: string;
  name: string;
}
interface Promo {
  id: string;
  name: string;
}

const ALL = "__all__";

export function OrdersFilterBar({
  categories,
  promos,
}: {
  categories: Category[];
  promos: Promo[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [q, setQ] = React.useState(searchParams.get("q") ?? "");
  const [dateFrom, setDateFrom] = React.useState(searchParams.get("dateFrom") ?? "");
  const [dateTo, setDateTo] = React.useState(searchParams.get("dateTo") ?? "");
  const [fulfillment, setFulfillment] = React.useState(searchParams.get("fulfillment") ?? ALL);
  const [productType, setProductType] = React.useState(searchParams.get("productType") ?? ALL);
  const [categoryId, setCategoryId] = React.useState(searchParams.get("categoryId") ?? ALL);
  const [promoId, setPromoId] = React.useState(searchParams.get("promoId") ?? ALL);

  const apply = () => {
    const params = new URLSearchParams(searchParams.toString());
    const set = (key: string, value: string) => {
      if (value && value !== ALL) params.set(key, value);
      else params.delete(key);
    };
    set("q", q);
    set("dateFrom", dateFrom);
    set("dateTo", dateTo);
    set("fulfillment", fulfillment);
    set("productType", productType);
    set("categoryId", categoryId);
    set("promoId", promoId);
    router.push(`${pathname}?${params.toString()}`);
  };

  const reset = () => {
    setQ("");
    setDateFrom("");
    setDateTo("");
    setFulfillment(ALL);
    setProductType(ALL);
    setCategoryId(ALL);
    setPromoId(ALL);
    const params = new URLSearchParams(searchParams.toString());
    ["q", "dateFrom", "dateTo", "fulfillment", "productType", "categoryId", "promoId"].forEach(
      (k) => params.delete(k)
    );
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <div className="grid grid-cols-2 gap-3 rounded-xl border border-border bg-card p-4 md:grid-cols-4 lg:grid-cols-7">
      <Input
        placeholder="Поиск: имя, телефон, №"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="col-span-2"
      />
      <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} aria-label="Дата с" />
      <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} aria-label="Дата по" />

      <Select value={fulfillment} onValueChange={setFulfillment}>
        <SelectTrigger><SelectValue placeholder="Получение" /></SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Доставка/самовывоз</SelectItem>
          <SelectItem value="DELIVERY">Доставка</SelectItem>
          <SelectItem value="PICKUP">Самовывоз</SelectItem>
        </SelectContent>
      </Select>

      <Select value={productType} onValueChange={setProductType}>
        <SelectTrigger><SelectValue placeholder="Тип товара" /></SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Все типы</SelectItem>
          {Object.entries(PRODUCT_TYPE_LABELS).map(([value, label]) => (
            <SelectItem key={value} value={value}>{label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={categoryId} onValueChange={setCategoryId}>
        <SelectTrigger><SelectValue placeholder="Категория" /></SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Все категории</SelectItem>
          {categories.map((c) => (
            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={promoId} onValueChange={setPromoId}>
        <SelectTrigger><SelectValue placeholder="Промо" /></SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Любое промо</SelectItem>
          {promos.map((p) => (
            <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="col-span-2 flex gap-2 lg:col-span-7">
        <Button size="sm" onClick={apply}>Применить фильтры</Button>
        <Button size="sm" variant="outline" onClick={reset}>Сбросить</Button>
      </div>
    </div>
  );
}
