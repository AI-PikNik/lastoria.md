"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil, Save, Trash2, X } from "lucide-react";
import { deleteCustomer, updateCustomer } from "@/lib/actions/customers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function CustomerForm({
  phone,
  initial,
  activeOrders,
}: {
  phone: string;
  initial: { customerName: string; phone: string; email: string };
  activeOrders: number;
}) {
  const router = useRouter();
  const [editing, setEditing] = React.useState(false);
  const [form, setForm] = React.useState(initial);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [pending, setPending] = React.useState(false);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setPending(true);
    const result = await updateCustomer(phone, form);
    setPending(false);
    if (!result.ok) {
      setErrors(result.fieldErrors ?? {});
      toast.error(result.error ?? "Ошибка");
      return;
    }
    toast.success("Данные клиента обновлены во всех его заказах");
    setEditing(false);
    if (result.phone && result.phone !== phone) router.replace(`/admin/customers/${encodeURIComponent(result.phone)}`);
    else router.refresh();
  };

  const remove = async () => {
    if (
      !window.confirm(
        "Удалить персональные данные клиента? Имя, телефон, email и адреса будут стёрты из всех его заказов. Суммы заказов останутся в статистике. Отменить это нельзя."
      )
    )
      return;
    const result = await deleteCustomer(phone);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Данные клиента удалены");
    router.push("/admin/customers");
  };

  if (!editing) {
    return (
      <section className="space-y-4 rounded-xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">Данные клиента</h2>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setEditing(true)}>
              <Pencil aria-hidden="true" /> Изменить данные
            </Button>
            <Button
              variant="danger"
              onClick={remove}
              disabled={activeOrders > 0}
              title={activeOrders > 0 ? "Сначала завершите или отмените заказы клиента" : undefined}
            >
              <Trash2 aria-hidden="true" /> Удалить клиента
            </Button>
          </div>
        </div>
        <dl className="grid gap-3 sm:grid-cols-3">
          <Item label="Имя" value={initial.customerName} />
          <Item label="Телефон" value={initial.phone} />
          <Item label="Email" value={initial.email || "—"} />
        </dl>
        {activeOrders > 0 && (
          <p className="text-xs text-muted-foreground">
            Удалить клиента можно после завершения или отмены его заказов (сейчас в работе: {activeOrders}).
          </p>
        )}
      </section>
    );
  }

  return (
    <form onSubmit={save} className="space-y-4 rounded-xl border-2 border-primary/50 bg-card p-5">
      <h2 className="font-semibold">Изменение данных клиента</h2>
      <div className="grid gap-3 md:grid-cols-3">
        <label className="block space-y-1 text-sm font-medium">
          Имя
          <Input value={form.customerName} onChange={(e) => setForm({ ...form, customerName: e.target.value })} autoFocus />
          {errors.customerName && <span className="block text-xs text-destructive">{errors.customerName}</span>}
        </label>
        <label className="block space-y-1 text-sm font-medium">
          Телефон
          <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          {errors.phone && <span className="block text-xs text-destructive">{errors.phone}</span>}
        </label>
        <label className="block space-y-1 text-sm font-medium">
          Email
          <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          {errors.email && <span className="block text-xs text-destructive">{errors.email}</span>}
        </label>
      </div>
      <p className="text-xs text-muted-foreground">Изменения применяются ко всем заказам этого клиента.</p>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={pending}>
          <Save aria-hidden="true" /> {pending ? "Сохранение…" : "Сохранить"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setForm(initial);
            setErrors({});
            setEditing(false);
          }}
        >
          <X aria-hidden="true" /> Отмена
        </Button>
      </div>
    </form>
  );
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-muted/60 px-3 py-2">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}
