"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { updateSettings } from "@/lib/actions/settings";

interface Zone {
  name: string;
  fee: number;
}

interface SettingsData {
  restaurantName: string;
  restaurantPhone: string;
  restaurantAddress: string;
  restaurantEmail: string;
  workingHours: string;
  minOrderAmount: number;
  seoDefaultTitle: string;
  seoDefaultDescription: string;
  telegramChatId: string;
  emailSenderAddress: string;
  deliveryZones: Zone[];
}

export function SettingsForm({ settings }: { settings: SettingsData }) {
  const router = useRouter();
  const [zones, setZones] = React.useState<Zone[]>(settings.deliveryZones);
  const [pending, setPending] = React.useState(false);
  const [errors, setErrors] = React.useState<Record<string, string>>({});

  const addZone = () => setZones((z) => [...z, { name: "", fee: 0 }]);
  const removeZone = (i: number) => setZones((z) => z.filter((_, idx) => idx !== i));
  const updateZone = (i: number, patch: Partial<Zone>) =>
    setZones((z) => z.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPending(true);
    setErrors({});
    const formData = new FormData(event.currentTarget);
    formData.set(
      "deliveryZones",
      JSON.stringify(zones.filter((z) => z.name.trim().length > 0))
    );

    const result = await updateSettings(formData);
    setPending(false);

    if (!result.ok) {
      setErrors(result.fieldErrors ?? {});
      toast.error(result.error ?? "Проверьте форму");
      return;
    }
    toast.success("Настройки сохранены");
    router.refresh();
  };

  return (
    <form onSubmit={handleSubmit} className="grid gap-6 lg:grid-cols-2">
      <section className="space-y-4 rounded-xl border border-border bg-card p-6">
        <h2 className="font-display font-semibold">Данные ресторана</h2>
        <div>
          <Label htmlFor="restaurantName">Название</Label>
          <Input id="restaurantName" name="restaurantName" defaultValue={settings.restaurantName} required />
        </div>
        <div>
          <Label htmlFor="restaurantPhone">Телефон</Label>
          <Input id="restaurantPhone" name="restaurantPhone" defaultValue={settings.restaurantPhone} required />
        </div>
        <div>
          <Label htmlFor="restaurantAddress">Адрес</Label>
          <Input id="restaurantAddress" name="restaurantAddress" defaultValue={settings.restaurantAddress} required />
        </div>
        <div>
          <Label htmlFor="restaurantEmail">Email ресторана</Label>
          <Input id="restaurantEmail" name="restaurantEmail" type="email" defaultValue={settings.restaurantEmail} />
        </div>
        <div>
          <Label htmlFor="workingHours">Часы работы</Label>
          <Input id="workingHours" name="workingHours" defaultValue={settings.workingHours} required />
        </div>
        <div>
          <Label htmlFor="minOrderAmount">Минимальная сумма заказа, MDL</Label>
          <Input id="minOrderAmount" name="minOrderAmount" type="number" step="0.01" defaultValue={settings.minOrderAmount} required />
        </div>
      </section>

      <section className="space-y-4 rounded-xl border border-border bg-card p-6">
        <h2 className="font-display font-semibold">SEO по умолчанию</h2>
        <div>
          <Label htmlFor="seoDefaultTitle">Заголовок по умолчанию</Label>
          <Input id="seoDefaultTitle" name="seoDefaultTitle" defaultValue={settings.seoDefaultTitle} required />
        </div>
        <div>
          <Label htmlFor="seoDefaultDescription">Описание по умолчанию</Label>
          <Textarea id="seoDefaultDescription" name="seoDefaultDescription" defaultValue={settings.seoDefaultDescription} required />
        </div>

        <h2 className="pt-4 font-display font-semibold">Интеграции</h2>
        <div>
          <Label htmlFor="telegramChatId">Telegram chat id администратора</Label>
          <Input id="telegramChatId" name="telegramChatId" defaultValue={settings.telegramChatId} placeholder="123456789" />
        </div>
        <div>
          <Label htmlFor="emailSenderAddress">Email отправителя</Label>
          <Input id="emailSenderAddress" name="emailSenderAddress" defaultValue={settings.emailSenderAddress} placeholder="no-reply@lastoria.md" />
        </div>
      </section>

      <section className="space-y-3 rounded-xl border border-border bg-card p-6 lg:col-span-2">
        <h2 className="font-display font-semibold">Зоны и цены доставки</h2>
        {zones.map((zone, index) => (
          <div key={index} className="flex items-center gap-2">
            <Input
              placeholder="Название зоны"
              value={zone.name}
              onChange={(e) => updateZone(index, { name: e.target.value })}
            />
            <Input
              type="number"
              placeholder="Стоимость, MDL"
              className="w-48"
              value={zone.fee}
              onChange={(e) => updateZone(index, { fee: Number(e.target.value) })}
            />
            <Button type="button" variant="ghost" size="icon" onClick={() => removeZone(index)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" onClick={addZone}>
          <Plus className="h-4 w-4" /> Добавить зону
        </Button>
      </section>

      <div className="space-y-2 lg:col-span-2">
        {Object.values(errors).map((message, index) => (
          <p key={index} className="text-sm text-destructive">{message}</p>
        ))}
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? "Сохранение…" : "Сохранить настройки"}
        </Button>
      </div>
    </form>
  );
}
