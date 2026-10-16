"use client";

import * as React from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ImagePlus, Loader2, MapPin, Pencil, Phone, Plus, Trash2 } from "lucide-react";
import {
  addLocationImages,
  deleteLocation,
  deleteLocationImage,
  reorderLocationImages,
  reorderLocations,
  saveLocation,
  setLocationActive,
  updateLocationImage,
} from "@/lib/actions/content";
import { uploadProductImages } from "@/lib/actions/products";
import { emptyLocalized, type LocalizedValue } from "@/lib/admin-forms";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { LocalizedFields } from "./localized-fields";
import { SortableList } from "./sortable-list";

export interface LocationImageRow {
  id: string;
  url: string;
  caption: LocalizedValue;
}

export interface LocationRow {
  id: string;
  name: LocalizedValue;
  description: LocalizedValue;
  hours: LocalizedValue;
  address: string;
  phone: string;
  mapUrl: string;
  isActive: boolean;
  images: LocationImageRow[];
}

type Result = { ok: boolean; error?: string; fieldErrors?: Record<string, string>; id?: string };

const pick = (v: LocalizedValue) => v.ru || v.ro || v.en || v.it || "—";

export function LocationsManager({ locations }: { locations: LocationRow[] }) {
  const router = useRouter();
  const [editing, setEditing] = React.useState<LocationRow | "new" | null>(null);

  const run = React.useCallback(
    async (promise: Promise<Result>, success: string) => {
      const result = await promise;
      if (!result.ok) toast.error(result.error ?? "Ошибка");
      else toast.success(success);
      router.refresh();
      return result;
    },
    [router]
  );

  return (
    <div className="space-y-6">
      <Button onClick={() => setEditing("new")}>
        <Plus /> Добавить заведение
      </Button>

      {locations.length === 0 && (
        <p className="rounded-xl border-2 border-dashed border-border-strong p-6 text-center text-sm text-muted-foreground">
          Заведений нет — на странице «О нас» будет только общий текст.
        </p>
      )}

      {locations.length > 1 && (
        <section className="rounded-xl border border-border bg-card">
          <h2 className="border-b border-border px-4 py-3 text-sm font-semibold">Порядок на странице «О нас»</h2>
          <SortableList
            items={locations}
            onReorder={(ids) => run(reorderLocations(ids), "Порядок сохранён")}
            renderItem={(l) => <span className="font-medium">{pick(l.name)}</span>}
          />
        </section>
      )}

      {locations.map((location) => (
        <section key={location.id} className="rounded-xl border-2 border-border-strong bg-card">
          <header className="flex flex-wrap items-start gap-3 border-b border-border p-4">
            <div className="min-w-48 flex-1 space-y-1">
              <h2 className="flex flex-wrap items-center gap-2 text-lg font-semibold">
                {pick(location.name)}
                {!location.isActive && <Badge variant="outline">скрыто</Badge>}
              </h2>
              <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                {location.address && (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="size-4" /> {location.address}
                  </span>
                )}
                {location.phone && (
                  <span className="inline-flex items-center gap-1">
                    <Phone className="size-4" /> {location.phone}
                  </span>
                )}
              </p>
              {pick(location.description) !== "—" && (
                <p className="line-clamp-2 text-sm">{pick(location.description)}</p>
              )}
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Switch
                checked={location.isActive}
                onCheckedChange={(on) => run(setLocationActive(location.id, on), on ? "Заведение показано" : "Заведение скрыто")}
                aria-label="Показывать на сайте"
              />
              На сайте
            </label>
            <Button variant="outline" size="sm" onClick={() => setEditing(location)}>
              <Pencil /> Изменить
            </Button>
            <Button
              variant="danger"
              size="sm"
              aria-label="Удалить заведение"
              onClick={() =>
                window.confirm(`Удалить «${pick(location.name)}» вместе с галереей? Можно просто скрыть.`) &&
                run(deleteLocation(location.id), "Заведение удалено")
              }
            >
              <Trash2 />
            </Button>
          </header>
          <Gallery location={location} run={run} />
        </section>
      ))}

      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          {editing !== null && (
            <LocationForm
              location={editing === "new" ? null : editing}
              onSave={async (data) => {
                const result = await run(saveLocation(editing === "new" ? null : editing.id, data), "Заведение сохранено");
                if (result.ok) setEditing(null);
                return result.fieldErrors ?? {};
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Gallery({
  location,
  run,
}: {
  location: LocationRow;
  run: (promise: Promise<Result>, success: string) => Promise<Result>;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = React.useState(false);
  const [captionFor, setCaptionFor] = React.useState<LocationImageRow | null>(null);

  const upload = async (files: FileList) => {
    const list = Array.from(files).slice(0, 10);
    if (list.length === 0) return;
    setUploading(true);
    const formData = new FormData();
    list.forEach((file) => formData.append("files", file));
    formData.append("folder", "locations");
    const uploaded = await uploadProductImages(formData);
    if (!uploaded.ok || !uploaded.urls?.length) {
      setUploading(false);
      toast.error(uploaded.error ?? "Не удалось загрузить фото");
      return;
    }
    await run(addLocationImages(location.id, uploaded.urls), `Добавлено фото: ${uploaded.urls.length}`);
    setUploading(false);
  };

  return (
    <div className="space-y-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">
          Галерея на странице «О нас» {location.images.length > 0 && `(${location.images.length})`}
        </h3>
        <Button variant="outline" size="sm" disabled={uploading} onClick={() => inputRef.current?.click()}>
          {uploading ? <Loader2 className="animate-spin" /> : <ImagePlus />} Добавить фото
        </Button>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => {
            if (e.target.files) void upload(e.target.files);
            e.target.value = "";
          }}
        />
      </div>
      {location.images.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Фото пока нет — галерея на сайте не показывается. Можно выбрать сразу несколько файлов (до 10 за раз, JPG/PNG/WEBP).
        </p>
      ) : (
        <SortableList
          items={location.images}
          onReorder={(ids) => run(reorderLocationImages(ids), "Порядок фото сохранён")}
          className="rounded-lg border border-border"
          renderItem={(image) => (
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative size-16 shrink-0 overflow-hidden rounded-md bg-muted">
                <Image src={image.url} alt="" fill sizes="64px" className="object-cover" />
              </div>
              <p className="min-w-32 flex-1 text-sm">
                {pick(image.caption) !== "—" ? pick(image.caption) : <span className="text-muted-foreground">без подписи</span>}
              </p>
              <Button variant="outline" size="sm" onClick={() => setCaptionFor(image)}>
                <Pencil /> Подпись
              </Button>
              <Button
                variant="danger"
                size="sm"
                aria-label="Удалить фото"
                onClick={() => window.confirm("Удалить фото из галереи?") && run(deleteLocationImage(image.id), "Фото удалено")}
              >
                <Trash2 />
              </Button>
            </div>
          )}
        />
      )}

      <Dialog open={captionFor !== null} onOpenChange={(open) => !open && setCaptionFor(null)}>
        <DialogContent className="max-w-xl">
          {captionFor && (
            <CaptionForm
              image={captionFor}
              onSave={async (caption) => {
                const result = await run(updateLocationImage(captionFor.id, { url: captionFor.url, caption }), "Подпись сохранена");
                if (result.ok) setCaptionFor(null);
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CaptionForm({ image, onSave }: { image: LocationImageRow; onSave: (caption: LocalizedValue) => void }) {
  const [caption, setCaption] = React.useState(image.caption);
  return (
    <div className="space-y-4">
      <DialogHeader>
        <DialogTitle>Подпись к фото</DialogTitle>
      </DialogHeader>
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-lg bg-muted">
        <Image src={image.url} alt="" fill sizes="560px" className="object-cover" />
      </div>
      <LocalizedFields
        id="caption"
        label="Подпись (видна под фото и нужна для поиска по картинкам)"
        value={caption}
        onChange={setCaption}
        maxLength={200}
      />
      <div className="flex justify-end">
        <Button onClick={() => onSave(caption)}>Сохранить</Button>
      </div>
    </div>
  );
}

function LocationForm({
  location,
  onSave,
}: {
  location: LocationRow | null;
  onSave: (data: Omit<LocationRow, "id" | "images">) => Promise<Record<string, string>>;
}) {
  const [v, setV] = React.useState<Omit<LocationRow, "id" | "images">>({
    name: location?.name ?? emptyLocalized(),
    description: location?.description ?? emptyLocalized(),
    hours: location?.hours ?? emptyLocalized(),
    address: location?.address ?? "",
    phone: location?.phone ?? "",
    mapUrl: location?.mapUrl ?? "",
    isActive: location?.isActive ?? true,
  });
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [pending, setPending] = React.useState(false);
  const set = <K extends keyof typeof v>(key: K, value: (typeof v)[K]) => setV((prev) => ({ ...prev, [key]: value }));

  return (
    <div className="space-y-4">
      <DialogHeader>
        <DialogTitle>{location ? "Заведение" : "Новое заведение"}</DialogTitle>
      </DialogHeader>
      <LocalizedFields id="loc-name" label="Название (например, «La Storia — Centru»)" value={v.name} onChange={(x) => set("name", x)} error={errors.name} />
      <LocalizedFields
        id="loc-desc"
        label="Текст о месте (короткий или средний; пустая строка — новый абзац)"
        value={v.description}
        onChange={(x) => set("description", x)}
        multiline
        rows={6}
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block space-y-1 text-sm font-medium">
          Адрес
          <Input value={v.address} onChange={(e) => set("address", e.target.value)} placeholder="str. Ștefan cel Mare 1, Chișinău" />
        </label>
        <label className="block space-y-1 text-sm font-medium">
          Телефон
          <Input value={v.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+373 22 000 000" />
        </label>
      </div>
      <LocalizedFields id="loc-hours" label="Часы работы" value={v.hours} onChange={(x) => set("hours", x)} placeholder="Zilnic, 10:00–22:00" />
      <label className="block space-y-1 text-sm font-medium">
        Ссылка на карту (необязательно)
        <Input value={v.mapUrl} onChange={(e) => set("mapUrl", e.target.value)} placeholder="https://maps.app.goo.gl/…" />
        <span className="block text-xs font-normal text-muted-foreground">Пусто — ссылка на Google Maps по адресу</span>
        {errors.mapUrl && <span className="block text-xs text-destructive">{errors.mapUrl}</span>}
      </label>
      <label className="flex items-center justify-between rounded-lg border border-border p-3 text-sm">
        Показывать на странице «О нас»
        <Switch checked={v.isActive} onCheckedChange={(x) => set("isActive", x)} />
      </label>
      <div className="flex justify-end">
        <Button
          disabled={pending}
          onClick={async () => {
            setPending(true);
            setErrors(await onSave(v));
            setPending(false);
          }}
        >
          Сохранить
        </Button>
      </div>
    </div>
  );
}
