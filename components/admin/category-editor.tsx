"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { LOCALES, LOCALE_LABELS, LOCALE_SHORT, type AppLocale } from "@/lib/i18n/locales";
import { CATEGORY_KIND_LABELS } from "@/lib/constants";
import { createCategory, updateCategory } from "@/lib/actions/categories";
import { slugify } from "@/lib/slug";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { ImageUploadField } from "./image-upload-field";
import { MissingBadge } from "./localized-fields";

type Kind = keyof typeof CATEGORY_KIND_LABELS;
type Tr = { name: string; description: string; seoTitle: string; seoDescription: string };

export interface CategoryEditorData {
  id: string;
  slug: string;
  kind: Kind;
  isActive: boolean;
  isSystem: boolean;
  requiresAgeConfirm: boolean;
  imageUrl: string | null;
  translations: Record<AppLocale, Tr>;
}

const EMPTY_TR: Tr = { name: "", description: "", seoTitle: "", seoDescription: "" };

export function CategoryEditor({ category, trigger }: { category?: CategoryEditorData; trigger: React.ReactNode }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [lang, setLang] = React.useState<AppLocale>("ro");
  const [slug, setSlug] = React.useState(category?.slug ?? "");
  const [kind, setKind] = React.useState<Kind>(category?.kind ?? "CUSTOM");
  const [isActive, setIsActive] = React.useState(category?.isActive ?? true);
  const [age, setAge] = React.useState(category?.requiresAgeConfirm ?? false);
  const [imageUrl, setImageUrl] = React.useState<string | null>(category?.imageUrl ?? null);
  const [tr, setTr] = React.useState<Record<AppLocale, Tr>>(
    category?.translations ?? { ro: { ...EMPTY_TR }, ru: { ...EMPTY_TR }, en: { ...EMPTY_TR }, it: { ...EMPTY_TR } }
  );
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [pending, setPending] = React.useState(false);

  const setField = (field: keyof Tr, value: string) =>
    setTr((prev) => ({ ...prev, [lang]: { ...prev[lang], [field]: value } }));

  const submit = async () => {
    setPending(true);
    const payload = { slug, kind, isActive, requiresAgeConfirm: age, imageUrl, translations: tr };
    const result = category ? await updateCategory(category.id, payload) : await createCategory(payload);
    setPending(false);
    if (!result.ok) {
      setErrors(result.fieldErrors ?? {});
      toast.error(result.error ?? Object.values(result.fieldErrors ?? {})[0] ?? "Ошибка");
      return;
    }
    toast.success(category ? "Группа сохранена" : "Группа создана");
    setOpen(false);
    router.refresh();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{category ? "Группа товаров" : "Новая группа товаров"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div role="tablist" aria-label="Язык" className="flex flex-wrap gap-1 rounded-lg bg-muted p-1">
            {LOCALES.map((l) => (
              <button
                key={l}
                type="button"
                role="tab"
                aria-selected={lang === l}
                onClick={() => setLang(l)}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium",
                  lang === l ? "bg-card shadow-sm" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {LOCALE_SHORT[l]}
                {!tr[l].name.trim() && <MissingBadge />}
              </button>
            ))}
          </div>

          <div className="space-y-3 rounded-lg border border-border p-3">
            <p className="text-xs text-muted-foreground">Язык: {LOCALE_LABELS[lang]}</p>
            <label className="block space-y-1 text-sm font-medium">
              Название
              <Input
                value={tr[lang].name}
                onChange={(e) => {
                  setField("name", e.target.value);
                  if (!category && lang === "ro" && !slug) setSlug(slugify(e.target.value));
                }}
                onBlur={() => !category && !slug && setSlug(slugify(tr.ro.name || tr[lang].name))}
              />
            </label>
            <label className="block space-y-1 text-sm font-medium">
              Описание (показывается на странице группы)
              <Textarea rows={2} value={tr[lang].description} onChange={(e) => setField("description", e.target.value)} />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block space-y-1 text-sm font-medium">
                SEO-заголовок
                <Input value={tr[lang].seoTitle} onChange={(e) => setField("seoTitle", e.target.value)} maxLength={200} />
              </label>
              <label className="block space-y-1 text-sm font-medium">
                SEO-описание
                <Input value={tr[lang].seoDescription} onChange={(e) => setField("seoDescription", e.target.value)} maxLength={500} />
              </label>
            </div>
            {errors.translations && <p className="text-xs text-destructive">{errors.translations}</p>}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-1 text-sm font-medium">
              Адрес (slug)
              <Input value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase())} placeholder="pizza" />
              <span className="block text-xs font-normal text-muted-foreground">/menu/group/{slug || "…"}</span>
              {errors.slug && <span className="block text-xs text-destructive">{errors.slug}</span>}
            </label>
            <label className="block space-y-1 text-sm font-medium">
              Тип группы
              <NativeSelect
                value={kind}
                onChange={(e) => {
                  const next = e.target.value as Kind;
                  setKind(next);
                  if (next === "ALCOHOL") setAge(true);
                }}
              >
                {Object.entries(CATEGORY_KIND_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </NativeSelect>
              <span className="block text-xs font-normal text-muted-foreground">Нужен для промо «по типу» и аналитики</span>
            </label>
          </div>

          <ImageUploadField value={imageUrl} onChange={setImageUrl} folder="categories" label="Картинка группы (необязательно)" />

          <div className="flex flex-col gap-3 rounded-lg border border-border p-3">
            <label className="flex items-center justify-between gap-3 text-sm">
              <span>
                <span className="font-medium">Показывать на сайте</span>
                <span className="block text-xs text-muted-foreground">Скрытая группа и её товары не видны покупателям</span>
              </span>
              <Switch checked={isActive} onCheckedChange={setIsActive} />
            </label>
            <label className="flex items-center justify-between gap-3 text-sm">
              <span>
                <span className="font-medium">Товары 18+</span>
                <span className="block text-xs text-muted-foreground">Бейдж 18+ и подтверждение возраста при заказе (для алкоголя — всегда)</span>
              </span>
              <Switch checked={age || kind === "ALCOHOL"} disabled={kind === "ALCOHOL"} onCheckedChange={setAge} />
            </label>
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Отмена
            </Button>
            <Button type="button" onClick={submit} disabled={pending}>
              {pending ? "Сохранение…" : "Сохранить"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
