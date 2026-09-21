"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createPromo, updatePromo } from "@/lib/actions/promos";
import { PRODUCT_TYPE_LABELS } from "@/lib/constants";

interface Option {
  id: string;
  name: string;
}

interface PromoData {
  id: string;
  name: string;
  code: string | null;
  type: string;
  value: number;
  scope: string;
  targetIds: string[];
  minOrderAmount: number | null;
  startsAt: string;
  endsAt: string;
  isActive: boolean;
  stackable: boolean;
}

function toDateTimeLocal(value: string) {
  return value.slice(0, 16);
}

export function PromoForm({
  promo,
  products,
  categories,
}: {
  promo?: PromoData;
  products: Option[];
  categories: Option[];
}) {
  const router = useRouter();
  const [type, setType] = React.useState(promo?.type ?? "PERCENT");
  const [scope, setScope] = React.useState(promo?.scope ?? "PRODUCT");
  const [targetIds, setTargetIds] = React.useState<string[]>(promo?.targetIds ?? []);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  const toggleTarget = (id: string) => {
    setTargetIds((prev) => (prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPending(true);
    setErrors({});
    setFormError(null);

    const formData = new FormData(event.currentTarget);
    formData.set("type", type);
    formData.set("scope", scope);
    formData.set("targetIds", JSON.stringify(scope === "CART" ? [] : targetIds));

    const result = promo
      ? await updatePromo(promo.id, formData)
      : await createPromo(formData);

    setPending(false);
    if (!result.ok) {
      setErrors(result.fieldErrors ?? {});
      setFormError(result.error ?? null);
      toast.error(result.error ?? "Проверьте форму");
      return;
    }

    toast.success(promo ? "Промо обновлено" : "Промо создано");
    router.push("/admin/promos");
    router.refresh();
  };

  const targetOptions: Option[] =
    scope === "PRODUCT"
      ? products
      : scope === "CATEGORY"
      ? categories
      : scope === "PRODUCT_TYPE"
      ? Object.entries(PRODUCT_TYPE_LABELS).map(([id, name]) => ({ id, name }))
      : [];

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl space-y-6">
      <div className="space-y-4 rounded-xl border border-border bg-card p-6">
        <div>
          <Label htmlFor="name">Название</Label>
          <Input id="name" name="name" defaultValue={promo?.name} required />
          {errors.name && <p className="mt-1 text-xs text-destructive">{errors.name}</p>}
        </div>
        <div>
          <Label htmlFor="code">Промокод (необязательно)</Label>
          <Input id="code" name="code" defaultValue={promo?.code ?? ""} placeholder="LETO2026" />
          {errors.code && <p className="mt-1 text-xs text-destructive">{errors.code}</p>}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Тип скидки</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="PERCENT">Процент</SelectItem>
                <SelectItem value="FIXED">Фиксированная сумма</SelectItem>
                <SelectItem value="PRODUCT_OVERRIDE">Спец. цена товара</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="value">
              {type === "PERCENT" ? "Значение, %" : "Значение, MDL"}
            </Label>
            <Input id="value" name="value" type="number" step="0.01" defaultValue={promo?.value} required />
            {errors.value && <p className="mt-1 text-xs text-destructive">{errors.value}</p>}
          </div>
        </div>

        <div>
          <Label>Область действия</Label>
          <Select value={scope} onValueChange={(v) => { setScope(v); setTargetIds([]); }}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="PRODUCT">Товар</SelectItem>
              <SelectItem value="CATEGORY">Категория</SelectItem>
              <SelectItem value="PRODUCT_TYPE">Тип товара</SelectItem>
              <SelectItem value="CART">Вся корзина</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {scope !== "CART" && (
          <div>
            <Label>Цели</Label>
            <div className="mt-2 max-h-48 space-y-1 overflow-y-auto rounded-md border border-border p-3">
              {targetOptions.map((option) => (
                <div key={option.id} className="flex items-center gap-2">
                  <Checkbox
                    id={`target-${option.id}`}
                    checked={targetIds.includes(option.id)}
                    onCheckedChange={() => toggleTarget(option.id)}
                  />
                  <Label htmlFor={`target-${option.id}`} className="font-normal">
                    {option.name}
                  </Label>
                </div>
              ))}
            </div>
            {errors.targetIds && <p className="mt-1 text-xs text-destructive">{errors.targetIds}</p>}
          </div>
        )}

        <div>
          <Label htmlFor="minOrderAmount">Минимальная сумма заказа (необязательно)</Label>
          <Input id="minOrderAmount" name="minOrderAmount" type="number" step="0.01" defaultValue={promo?.minOrderAmount ?? ""} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="startsAt">Начало действия</Label>
            <Input
              id="startsAt"
              name="startsAt"
              type="datetime-local"
              defaultValue={promo ? toDateTimeLocal(promo.startsAt) : ""}
              required
            />
          </div>
          <div>
            <Label htmlFor="endsAt">Окончание действия</Label>
            <Input
              id="endsAt"
              name="endsAt"
              type="datetime-local"
              defaultValue={promo ? toDateTimeLocal(promo.endsAt) : ""}
              required
            />
            {errors.endsAt && <p className="mt-1 text-xs text-destructive">{errors.endsAt}</p>}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <Label htmlFor="isActive" className="font-normal">Активно</Label>
          <Switch id="isActive" name="isActive" defaultChecked={promo?.isActive ?? true} />
        </div>
        <div className="flex items-center justify-between">
          <Label htmlFor="stackable" className="font-normal">
            Суммируется с другими промо
          </Label>
          <Switch id="stackable" name="stackable" defaultChecked={promo?.stackable ?? false} />
        </div>

        {formError && <p className="text-sm text-destructive">{formError}</p>}
      </div>

      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "Сохранение…" : promo ? "Сохранить изменения" : "Создать промо"}
      </Button>
    </form>
  );
}
