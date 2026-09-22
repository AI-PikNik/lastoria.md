"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Eye, EyeOff, Pencil, Plus, Trash2 } from "lucide-react";
import { deleteCity, deleteZone, reorderZones, saveCity, saveZone } from "@/lib/actions/delivery";
import { emptyLocalized, type LocalizedValue } from "@/lib/admin-forms";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { LocalizedFields, MissingBadge } from "./localized-fields";
import { SortableList } from "./sortable-list";

export interface ZoneRow {
  id: string;
  names: LocalizedValue;
  fee: number;
  freeFrom: number | null;
  isActive: boolean;
}

export interface CityRow {
  id: string;
  slug: string;
  names: LocalizedValue;
  isActive: boolean;
  zones: ZoneRow[];
}

type Editing =
  | { type: "city"; city: CityRow | null }
  | { type: "zone"; cityId: string; zone: ZoneRow | null }
  | null;

const displayName = (names: LocalizedValue) => names.ru || names.ro || names.en || names.it || "—";

export function DeliveryManager({ cities }: { cities: CityRow[] }) {
  const router = useRouter();
  const [editing, setEditing] = React.useState<Editing>(null);

  const run = async (promise: Promise<{ ok: boolean; error?: string }>, success: string) => {
    const result = await promise;
    if (!result.ok) toast.error(result.error ?? "Ошибка");
    else toast.success(success);
    router.refresh();
    return result.ok;
  };

  return (
    <div className="space-y-6">
      <Button onClick={() => setEditing({ type: "city", city: null })}>
        <Plus /> Добавить город
      </Button>

      {cities.map((city) => (
        <section key={city.id} className="rounded-xl border border-border bg-card">
          <header className="flex flex-wrap items-center gap-3 border-b border-border p-4">
            <div className="flex-1">
              <h2 className="flex flex-wrap items-center gap-2 text-lg font-semibold">
                {displayName(city.names)}
                {!city.isActive && <Badge variant="outline">скрыт</Badge>}
              </h2>
              <p className="text-xs text-muted-foreground">
                RO: {city.names.ro || "—"} · EN: {city.names.en || "—"} · IT: {city.names.it || "—"} · районов: {city.zones.length}
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={() => setEditing({ type: "city", city })}>
              <Pencil /> Город
            </Button>
            {city.zones.length === 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => window.confirm("Удалить город?") && run(deleteCity(city.id), "Город удалён")}
              >
                <Trash2 className="text-destructive" />
              </Button>
            )}
            <Button size="sm" onClick={() => setEditing({ type: "zone", cityId: city.id, zone: null })}>
              <Plus /> Район
            </Button>
          </header>

          {city.zones.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">Районов пока нет — добавьте первый.</p>
          ) : (
            <SortableList
              items={city.zones}
              onReorder={(ids) => run(reorderZones(ids), "Порядок районов сохранён")}
              renderItem={(zone) => (
                <div className="flex flex-wrap items-center gap-3">
                  <div className="min-w-40 flex-1">
                    <p className="flex flex-wrap items-center gap-2 font-medium">
                      {displayName(zone.names)}
                      {!zone.isActive && <Badge variant="outline">скрыт</Badge>}
                      {(["ro", "en", "it"] as const).filter((l) => !zone.names[l]).map((l) => (
                        <MissingBadge key={l} locale={l} />
                      ))}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {zone.fee} MDL{zone.freeFrom ? ` · бесплатно от ${zone.freeFrom} MDL` : ""}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    title={zone.isActive ? "Скрыть" : "Показать"}
                    onClick={() =>
                      run(
                        saveZone(zone.id, { cityId: city.id, names: zone.names, fee: zone.fee, freeFrom: zone.freeFrom, isActive: !zone.isActive }),
                        zone.isActive ? "Район скрыт" : "Район показан"
                      )
                    }
                  >
                    {zone.isActive ? <EyeOff /> : <Eye />}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setEditing({ type: "zone", cityId: city.id, zone })}>
                    <Pencil /> Изменить
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => window.confirm(`Удалить район «${displayName(zone.names)}»?`) && run(deleteZone(zone.id), "Район удалён")}
                  >
                    <Trash2 className="text-destructive" />
                  </Button>
                </div>
              )}
            />
          )}
        </section>
      ))}

      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-w-2xl">
          {editing?.type === "city" && (
            <CityForm
              city={editing.city}
              onSave={async (data) => {
                if (await run(saveCity(editing.city?.id ?? null, data), "Город сохранён")) setEditing(null);
              }}
            />
          )}
          {editing?.type === "zone" && (
            <ZoneForm
              zone={editing.zone}
              onSave={async (data) => {
                if (await run(saveZone(editing.zone?.id ?? null, { ...data, cityId: editing.cityId }), "Район сохранён")) setEditing(null);
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CityForm({
  city,
  onSave,
}: {
  city: CityRow | null;
  onSave: (data: { slug: string; names: LocalizedValue; isActive: boolean }) => void;
}) {
  const [names, setNames] = React.useState(city?.names ?? emptyLocalized());
  const [slug, setSlug] = React.useState(city?.slug ?? "");
  const [isActive, setIsActive] = React.useState(city?.isActive ?? true);
  return (
    <div className="space-y-4">
      <DialogHeader>
        <DialogTitle>{city ? "Город" : "Новый город"}</DialogTitle>
      </DialogHeader>
      <LocalizedFields id="city" label="Название города" value={names} onChange={setNames} />
      <label className="block space-y-1 text-sm font-medium">
        Код (латиница, для системы)
        <Input value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))} placeholder="balti" />
      </label>
      <label className="flex items-center justify-between rounded-lg border border-border p-3 text-sm">
        Показывать при оформлении заказа
        <Switch checked={isActive} onCheckedChange={setIsActive} />
      </label>
      <div className="flex justify-end">
        <Button onClick={() => onSave({ slug, names, isActive })}>Сохранить</Button>
      </div>
    </div>
  );
}

function ZoneForm({
  zone,
  onSave,
}: {
  zone: ZoneRow | null;
  onSave: (data: { names: LocalizedValue; fee: number; freeFrom: number | null; isActive: boolean }) => void;
}) {
  const [names, setNames] = React.useState(zone?.names ?? emptyLocalized());
  const [fee, setFee] = React.useState(zone ? String(zone.fee) : "");
  const [freeFrom, setFreeFrom] = React.useState(zone?.freeFrom ? String(zone.freeFrom) : "");
  const [isActive, setIsActive] = React.useState(zone?.isActive ?? true);
  return (
    <div className="space-y-4">
      <DialogHeader>
        <DialogTitle>{zone ? "Район доставки" : "Новый район"}</DialogTitle>
      </DialogHeader>
      <LocalizedFields id="zone" label="Название района" value={names} onChange={setNames} />
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block space-y-1 text-sm font-medium">
          Стоимость доставки, MDL
          <Input type="number" min="0" step="1" value={fee} onChange={(e) => setFee(e.target.value)} />
        </label>
        <label className="block space-y-1 text-sm font-medium">
          Бесплатно от суммы заказа, MDL (необязательно)
          <Input type="number" min="0" step="1" value={freeFrom} onChange={(e) => setFreeFrom(e.target.value)} />
        </label>
      </div>
      <label className="flex items-center justify-between rounded-lg border border-border p-3 text-sm">
        Доступен для заказа
        <Switch checked={isActive} onCheckedChange={setIsActive} />
      </label>
      <div className="flex justify-end">
        <Button onClick={() => onSave({ names, fee: Number(fee || 0), freeFrom: freeFrom ? Number(freeFrom) : null, isActive })}>
          Сохранить
        </Button>
      </div>
    </div>
  );
}
