"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Minus, Pencil, Plus, Trash2 } from "lucide-react";
import { updateOrderContent } from "@/lib/actions/orders";
import { orderTotals, recalcOrderLines } from "@/lib/order-edit";
import { formatMoney } from "@/lib/format";
import type { ProductPickerOption } from "@/lib/admin-data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";

export interface EditableOrder {
  id: string;
  customerName: string;
  phone: string;
  email: string;
  fulfillment: "DELIVERY" | "PICKUP";
  address: string;
  comment: string;
  paymentMethod: "CASH" | "CARD_ON_DELIVERY";
  deliveryFee: number;
  items: { id: string; name: string; variant: string | null; qty: number; unitPrice: number; lineTotal: number }[];
}

interface Line {
  key: string;
  id: string | null;
  productId?: string;
  variantKey?: string | null;
  name: string;
  qty: number;
  unitPrice: number;
}

const money = (v: number) => formatMoney(v, "admin");

export function OrderEditor({ order, products }: { order: EditableOrder; products: ProductPickerOption[] }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [lines, setLines] = React.useState<Line[]>([]);
  const [form, setForm] = React.useState(order);
  const [pick, setPick] = React.useState({ productId: "", variantKey: "", qty: 1 });
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [pending, setPending] = React.useState(false);

  const start = () => {
    setLines(
      order.items.map((i) => ({
        key: i.id,
        id: i.id,
        name: i.variant ? `${i.name} (${i.variant})` : i.name,
        qty: i.qty,
        unitPrice: i.unitPrice,
      }))
    );
    setForm(order);
    setErrors({});
    setOpen(true);
  };

  if (!open) {
    return (
      <Button variant="outline" onClick={start}>
        <Pencil /> Изменить заказ
      </Button>
    );
  }

  const existing = order.items.map((i) => ({ id: i.id, qty: i.qty, unitPrice: i.unitPrice, lineTotal: i.lineTotal }));
  const recalculated = recalcOrderLines(
    existing,
    lines.map((l) => (l.id ? { id: l.id, qty: l.qty } : { qty: l.qty, unitPrice: l.unitPrice }))
  );
  const totals = orderTotals(recalculated, form.fulfillment === "DELIVERY" ? form.deliveryFee : 0);
  const product = products.find((p) => p.id === pick.productId);

  const addLine = () => {
    if (!product) return;
    const variant = product.variants.find((v) => v.key === pick.variantKey) ?? product.variants[0];
    setLines((prev) => [
      ...prev,
      {
        key: `new-${Date.now()}`,
        id: null,
        productId: product.id,
        variantKey: variant?.key ?? null,
        name: variant ? `${product.name} (${variant.name})` : product.name,
        qty: Math.max(1, pick.qty),
        unitPrice: product.price + (variant?.priceDelta ?? 0),
      },
    ]);
    setPick({ productId: "", variantKey: "", qty: 1 });
  };

  const save = async () => {
    setPending(true);
    const result = await updateOrderContent(order.id, {
      ...form,
      items: lines.map((l) => ({ id: l.id, productId: l.productId, variantKey: l.variantKey, qty: l.qty })),
    });
    setPending(false);
    if (!result.ok) {
      setErrors(result.fieldErrors ?? {});
      toast.error(result.error ?? "Не удалось сохранить");
      return;
    }
    toast.success("Заказ изменён");
    setOpen(false);
    router.refresh();
  };

  const set = <K extends keyof EditableOrder>(key: K, value: EditableOrder[K]) => setForm((f) => ({ ...f, [key]: value }));

  return (
    <section className="w-full basis-full space-y-5 rounded-xl border-2 border-primary/40 bg-card p-5">
      <h2 className="text-lg font-semibold">Изменение заказа</h2>

      <div className="space-y-2">
        <p className="text-sm font-medium">Позиции</p>
        <ul className="divide-y divide-border rounded-lg border border-border">
          {lines.map((line, index) => (
            <li key={line.key} className="flex flex-wrap items-center gap-3 px-3 py-2">
              <span className="min-w-40 flex-1 text-sm">
                {line.name}
                {!line.id && <span className="ml-2 rounded bg-success/15 px-1.5 text-xs text-success">новая</span>}
                <span className="block text-xs text-muted-foreground">{money(line.unitPrice)} / шт.</span>
              </span>
              <div className="flex items-center rounded-md border-2 border-border-strong bg-white">
                <button type="button" className="p-2 hover:bg-muted disabled:opacity-40" disabled={line.qty <= 1} aria-label="Меньше"
                  onClick={() => setLines((p) => p.map((l, i) => (i === index ? { ...l, qty: l.qty - 1 } : l)))}>
                  <Minus className="size-4" />
                </button>
                <span className="w-8 text-center text-sm font-semibold">{line.qty}</span>
                <button type="button" className="p-2 hover:bg-muted disabled:opacity-40" disabled={line.qty >= 50} aria-label="Больше"
                  onClick={() => setLines((p) => p.map((l, i) => (i === index ? { ...l, qty: l.qty + 1 } : l)))}>
                  <Plus className="size-4" />
                </button>
              </div>
              <span className="w-24 text-right text-sm font-medium">{money(recalculated[index]?.lineTotal ?? 0)}</span>
              <Button type="button" variant="ghost" size="sm" disabled={lines.length <= 1} title="Убрать позицию"
                onClick={() => setLines((p) => p.filter((_, i) => i !== index))}>
                <Trash2 className="text-destructive" />
              </Button>
            </li>
          ))}
        </ul>

        <div className="flex flex-wrap items-end gap-2 rounded-lg bg-muted/50 p-3">
          <label className="min-w-56 flex-1 space-y-1 text-xs font-medium">
            Добавить товар
            <NativeSelect value={pick.productId} onChange={(e) => setPick({ productId: e.target.value, variantKey: "", qty: pick.qty })}>
              <option value="">— выберите товар —</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} — {money(p.price)}
                </option>
              ))}
            </NativeSelect>
          </label>
          {product && product.variants.length > 0 && (
            <label className="w-40 space-y-1 text-xs font-medium">
              Вариант
              <NativeSelect value={pick.variantKey || product.variants[0].key} onChange={(e) => setPick({ ...pick, variantKey: e.target.value })}>
                {product.variants.map((v) => (
                  <option key={v.key} value={v.key}>
                    {v.name} ({v.priceDelta >= 0 ? "+" : ""}{v.priceDelta})
                  </option>
                ))}
              </NativeSelect>
            </label>
          )}
          <label className="w-20 space-y-1 text-xs font-medium">
            Кол-во
            <Input type="number" min={1} max={50} value={pick.qty} onChange={(e) => setPick({ ...pick, qty: Number(e.target.value) || 1 })} />
          </label>
          <Button type="button" onClick={addLine} disabled={!product}>
            <Plus /> Добавить
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Новые позиции — по текущей цене каталога без промо-скидки. У старых позиций цена и скидка сохраняются.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Имя клиента" error={errors.customerName}>
          <Input value={form.customerName} onChange={(e) => set("customerName", e.target.value)} />
        </Field>
        <Field label="Телефон" error={errors.phone}>
          <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} />
        </Field>
        <Field label="Email" error={errors.email}>
          <Input value={form.email} onChange={(e) => set("email", e.target.value)} />
        </Field>
        <Field label="Оплата">
          <NativeSelect value={form.paymentMethod} onChange={(e) => set("paymentMethod", e.target.value as EditableOrder["paymentMethod"])}>
            <option value="CASH">Наличными</option>
            <option value="CARD_ON_DELIVERY">Картой при получении</option>
          </NativeSelect>
        </Field>
        <Field label="Получение">
          <NativeSelect value={form.fulfillment} onChange={(e) => set("fulfillment", e.target.value as EditableOrder["fulfillment"])}>
            <option value="DELIVERY">Доставка</option>
            <option value="PICKUP">Самовывоз</option>
          </NativeSelect>
        </Field>
        {form.fulfillment === "DELIVERY" && (
          <Field label="Стоимость доставки, MDL">
            <Input type="number" min={0} value={form.deliveryFee} onChange={(e) => set("deliveryFee", Number(e.target.value) || 0)} />
          </Field>
        )}
        {form.fulfillment === "DELIVERY" && (
          <Field label="Адрес" error={errors.address}>
            <Input value={form.address} onChange={(e) => set("address", e.target.value)} />
          </Field>
        )}
        <Field label="Комментарий к заказу">
          <Textarea rows={2} value={form.comment} onChange={(e) => set("comment", e.target.value)} />
        </Field>
      </div>

      <dl className="grid gap-1 rounded-lg bg-muted/50 p-3 text-sm sm:max-w-sm">
        <div className="flex justify-between"><dt>Товары</dt><dd>{money(totals.subtotal)}</dd></div>
        {totals.discountTotal > 0 && <div className="flex justify-between"><dt>Скидка</dt><dd>−{money(totals.discountTotal)}</dd></div>}
        {form.fulfillment === "DELIVERY" && <div className="flex justify-between"><dt>Доставка</dt><dd>{money(totals.deliveryFee)}</dd></div>}
        <div className="flex justify-between text-base font-semibold"><dt>Новый итог</dt><dd>{money(totals.total)}</dd></div>
      </dl>

      <div className="flex flex-wrap gap-2">
        <Button onClick={save} disabled={pending}>{pending ? "Сохранение…" : "Сохранить изменения"}</Button>
        <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>Отмена</Button>
      </div>
    </section>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1 text-sm font-medium">
      {label}
      {children}
      {error && <span className="block text-xs text-destructive">{error}</span>}
    </label>
  );
}
