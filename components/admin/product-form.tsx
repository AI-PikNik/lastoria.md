"use client";

import * as React from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2, Circle, ExternalLink, ImagePlus, Loader2, Plus, Star, Trash2, TriangleAlert } from "lucide-react";
import { createProduct, updateProduct, uploadProductImages } from "@/lib/actions/products";
import { LOCALES, LOCALE_LABELS, LOCALE_SHORT, localizedPath, type AppLocale } from "@/lib/i18n/locales";
import { productSeoChecklist } from "@/lib/seo-checklist";
import { slugify } from "@/lib/slug";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { MissingBadge } from "./localized-fields";
import { emptyLocalized, type ProductFormValues, type ProductTranslationForm } from "@/lib/admin-forms";

export type { ProductFormValues } from "@/lib/admin-forms";

type Tab = "main" | "texts" | "photos" | "variants" | "seo";

const TABS: { id: Tab; label: string }[] = [
  { id: "main", label: "Основное" },
  { id: "texts", label: "Названия и описания" },
  { id: "photos", label: "Фото" },
  { id: "variants", label: "Варианты" },
  { id: "seo", label: "SEO" },
];

export function ProductForm({
  productId,
  initial,
  categories,
}: {
  productId?: string;
  initial: ProductFormValues;
  categories: { id: string; name: string; kind: string }[];
}) {
  const router = useRouter();
  const [v, setV] = React.useState<ProductFormValues>(initial);
  const [tab, setTab] = React.useState<Tab>("main");
  const [lang, setLang] = React.useState<AppLocale>("ro");
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [pending, setPending] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  const [dragIndex, setDragIndex] = React.useState<number | null>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);

  const set = <K extends keyof ProductFormValues>(key: K, value: ProductFormValues[K]) =>
    setV((prev) => ({ ...prev, [key]: value }));
  const setTr = (field: keyof ProductTranslationForm, value: string) =>
    setV((prev) => ({
      ...prev,
      translations: { ...prev.translations, [lang]: { ...prev.translations[lang], [field]: value } },
    }));

  const missing = LOCALES.filter((l) => !v.translations[l].name.trim());
  const selectedCategory = categories.find((c) => c.id === v.categoryId);

  /* ── Фото ── */
  const uploadFiles = async (files: FileList | File[]) => {
    const list = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (list.length === 0) return;
    setUploading(true);
    const formData = new FormData();
    list.forEach((file) => formData.append("files", file));
    const result = await uploadProductImages(formData);
    setUploading(false);
    if (!result.ok || !result.urls) {
      toast.error(result.error ?? "Не удалось загрузить фото");
      return;
    }
    setV((prev) => ({ ...prev, images: [...prev.images, ...result.urls!] }));
    toast.success(`Загружено фото: ${result.urls.length}. Не забудьте сохранить товар.`);
  };

  const moveImage = (from: number, to: number) => {
    if (from === to || to < 0 || to >= v.images.length) return;
    const next = [...v.images];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    set("images", next);
  };

  /* ── Сохранение ── */
  const submit = async () => {
    setPending(true);
    setErrors({});
    const payload = {
      slug: v.slug.trim(),
      categoryId: v.categoryId,
      price: v.price,
      oldPrice: v.oldPrice ? v.oldPrice : null,
      isAlcohol: v.isAlcohol,
      isVegetarian: v.isVegetarian,
      isSpicy: v.isSpicy,
      isActive: v.isActive,
      isFeatured: v.isFeatured,
      sku: v.sku,
      sortOrder: v.sortOrder || 0,
      stock: v.stock ? v.stock : null,
      images: v.images,
      ogImageUrl: v.ogImageUrl,
      variants: v.variants.map((variant) => ({ ...variant, priceDelta: variant.priceDelta || 0 })),
      translations: v.translations,
    };
    const result = productId ? await updateProduct(productId, payload) : await createProduct(payload);
    setPending(false);
    if (!result.ok) {
      const fieldErrors = result.fieldErrors ?? {};
      setErrors(fieldErrors);
      const first = Object.keys(fieldErrors)[0] ?? "";
      if (first.startsWith("translations")) setTab("texts");
      else if (first.startsWith("variants")) setTab("variants");
      else if (first) setTab("main");
      toast.error(result.error ?? Object.values(fieldErrors)[0] ?? "Проверьте форму");
      return;
    }
    toast.success(productId ? "Товар сохранён — сайт обновлён" : "Товар создан");
    if (!productId && result.id) router.push(`/admin/products/${result.id}`);
    router.refresh();
  };

  const tr = v.translations[lang];

  return (
    <div className="space-y-4">
      {/* Вкладки */}
      <div role="tablist" className="flex flex-wrap gap-1 border-b border-border">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium",
              tab === t.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {t.label}
            {t.id === "texts" && missing.length > 0 && <MissingBadge />}
            {t.id === "photos" && <span className="text-xs text-muted-foreground">({v.images.length})</span>}
          </button>
        ))}
      </div>

      {/* Переключатель языка для текстовых вкладок */}
      {(tab === "texts" || tab === "seo") && (
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
              {LOCALE_SHORT[l]} · {LOCALE_LABELS[l]}
              {!v.translations[l].name.trim() && <MissingBadge />}
            </button>
          ))}
        </div>
      )}

      <div className="rounded-xl border border-border bg-card p-5">
        {tab === "main" && (
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Группа" error={errors.categoryId}>
              <NativeSelect value={v.categoryId} onChange={(e) => set("categoryId", e.target.value)}>
                <option value="">— выберите —</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Адрес страницы (slug)" error={errors.slug} hint={`/menu/${v.slug || "…"}`}>
              <div className="flex gap-2">
                <Input value={v.slug} onChange={(e) => set("slug", e.target.value.toLowerCase())} placeholder="pizza-margherita" />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-11"
                  onClick={() => set("slug", slugify(v.translations.ro.name || v.translations.ru.name || v.translations.en.name))}
                >
                  Из названия
                </Button>
              </div>
            </Field>
            <Field label="Цена, MDL" error={errors.price}>
              <Input type="number" min="0" step="0.01" inputMode="decimal" value={v.price} onChange={(e) => set("price", e.target.value)} />
            </Field>
            <Field label="Старая цена, MDL (зачёркнутая, необязательно)" error={errors.oldPrice}>
              <Input type="number" min="0" step="0.01" inputMode="decimal" value={v.oldPrice} onChange={(e) => set("oldPrice", e.target.value)} />
            </Field>
            <Field label="Артикул (SKU)">
              <Input value={v.sku} onChange={(e) => set("sku", e.target.value)} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Порядок в группе">
                <Input type="number" value={v.sortOrder} onChange={(e) => set("sortOrder", e.target.value)} />
              </Field>
              <Field label="Остаток (пусто — без учёта)">
                <Input type="number" value={v.stock} onChange={(e) => set("stock", e.target.value)} />
              </Field>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 md:col-span-2">
              <Toggle label="Показывать на сайте" checked={v.isActive} onChange={(x) => set("isActive", x)} />
              <Toggle label="Хит (показывать на главной)" checked={v.isFeatured} onChange={(x) => set("isFeatured", x)} />
              <Toggle label="Вегетарианское" checked={v.isVegetarian} onChange={(x) => set("isVegetarian", x)} />
              <Toggle label="Острое" checked={v.isSpicy} onChange={(x) => set("isSpicy", x)} />
              <Toggle
                label="Алкоголь (18+)"
                hint={selectedCategory?.kind === "ALCOHOL" ? "Группа уже 18+ — бейдж и проверка возраста включены" : "Бейдж 18+ и подтверждение возраста"}
                checked={v.isAlcohol || selectedCategory?.kind === "ALCOHOL"}
                disabled={selectedCategory?.kind === "ALCOHOL"}
                onChange={(x) => set("isAlcohol", x)}
              />
            </div>
          </div>
        )}

        {tab === "texts" && (
          <div className="space-y-4">
            <Field label={`Название (${LOCALE_SHORT[lang]})`} error={errors.translations}>
              <Input value={tr.name} onChange={(e) => setTr("name", e.target.value)} maxLength={200} />
            </Field>
            <Field label="Краткое описание (под названием в карточке)">
              <Textarea rows={2} value={tr.shortDescription} onChange={(e) => setTr("shortDescription", e.target.value)} maxLength={500} />
            </Field>
            <Field label="Состав / ингредиенты (через запятую)">
              <Input value={tr.ingredientsText} onChange={(e) => setTr("ingredientsText", e.target.value)} maxLength={2000} />
            </Field>
            <Field label="Полное описание (Markdown: **жирный**, списки через «-»)">
              <Textarea rows={8} value={tr.description} onChange={(e) => setTr("description", e.target.value)} maxLength={20000} />
            </Field>
            <Field label="Alt-текст главного фото (что изображено)">
              <Input value={tr.imageAlt} onChange={(e) => setTr("imageAlt", e.target.value)} maxLength={300} />
            </Field>
            {!tr.name.trim() && (
              <p className="flex items-center gap-2 rounded-md bg-amber-50 p-3 text-sm text-amber-900">
                <TriangleAlert className="size-4" /> Для этого языка нет перевода. На сайте покажется румынский текст (а если его нет — первый заполненный язык).
              </p>
            )}
          </div>
        )}

        {tab === "photos" && (
          <div className="space-y-4">
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (e.dataTransfer.files.length > 0) void uploadFiles(e.dataTransfer.files);
              }}
              className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border p-6 text-center"
            >
              {uploading ? <Loader2 className="size-6 animate-spin text-muted-foreground" /> : <ImagePlus className="size-6 text-muted-foreground" />}
              <p className="text-sm">Перетащите фото сюда или</p>
              <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
                Выбрать файлы
              </Button>
              <p className="text-xs text-muted-foreground">JPG, PNG, WEBP до 5 МБ. Первое фото — главное. Порядок меняется перетаскиванием.</p>
              <input
                ref={fileRef}
                type="file"
                multiple
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files) void uploadFiles(e.target.files);
                  e.target.value = "";
                }}
              />
            </div>
            {v.images.length > 0 && (
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                {v.images.map((url, index) => (
                  <li
                    key={url}
                    draggable
                    onDragStart={() => setDragIndex(index)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (dragIndex !== null) moveImage(dragIndex, index);
                      setDragIndex(null);
                    }}
                    className={cn(
                      "group relative overflow-hidden rounded-lg border bg-muted",
                      index === 0 ? "border-primary ring-2 ring-primary/30" : "border-border",
                      dragIndex === index && "opacity-50"
                    )}
                  >
                    <div className="relative aspect-square cursor-grab">
                      <Image src={url} alt="" fill sizes="200px" className="object-cover" />
                    </div>
                    {index === 0 && (
                      <span className="absolute left-1 top-1 rounded bg-primary px-1.5 py-0.5 text-[11px] font-semibold text-primary-foreground">
                        Главное
                      </span>
                    )}
                    <div className="flex items-center justify-between gap-1 p-1">
                      <Button type="button" variant="ghost" size="sm" disabled={index === 0} onClick={() => moveImage(index, 0)} title="Сделать главным">
                        <Star />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => set("images", v.images.filter((u) => u !== url))}
                        title="Убрать фото"
                      >
                        <Trash2 className="text-destructive" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {tab === "variants" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Размеры или объёмы. Цена варианта = цена товара + надбавка. Если вариантов нет — товар продаётся по базовой цене.
            </p>
            {errors.variants && <p className="text-sm text-destructive">{errors.variants}</p>}
            {v.variants.map((variant, index) => (
              <div key={index} className="space-y-3 rounded-lg border border-border p-3">
                <div className="flex flex-wrap items-end gap-3">
                  <Field label="Ключ (латиница)">
                    <Input
                      value={variant.key}
                      onChange={(e) => {
                        const next = [...v.variants];
                        next[index] = { ...variant, key: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") };
                        set("variants", next);
                      }}
                      className="w-32"
                    />
                  </Field>
                  <Field label="Надбавка к цене, MDL">
                    <Input
                      type="number"
                      step="0.01"
                      value={variant.priceDelta}
                      onChange={(e) => {
                        const next = [...v.variants];
                        next[index] = { ...variant, priceDelta: e.target.value };
                        set("variants", next);
                      }}
                      className="w-32"
                    />
                  </Field>
                  <Button type="button" variant="ghost" size="sm" className="ml-auto" onClick={() => set("variants", v.variants.filter((_, i) => i !== index))}>
                    <Trash2 className="text-destructive" /> Удалить
                  </Button>
                </div>
                <div className="grid gap-2 sm:grid-cols-4">
                  {LOCALES.map((l) => (
                    <label key={l} className="space-y-1 text-xs font-medium">
                      <span className="flex items-center gap-1">
                        {LOCALE_SHORT[l]} {!variant.names[l]?.trim() && <MissingBadge />}
                      </span>
                      <Input
                        value={variant.names[l]}
                        onChange={(e) => {
                          const next = [...v.variants];
                          next[index] = { ...variant, names: { ...variant.names, [l]: e.target.value } };
                          set("variants", next);
                        }}
                        placeholder="30 cm"
                      />
                    </label>
                  ))}
                </div>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              onClick={() => set("variants", [...v.variants, { key: `v${v.variants.length + 1}`, priceDelta: "0", names: emptyLocalized() }])}
            >
              <Plus /> Добавить вариант
            </Button>
          </div>
        )}

        {tab === "seo" && (
          <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
            <div className="space-y-4">
              <Field label={`SEO-заголовок (${LOCALE_SHORT[lang]})`} hint={`${tr.seoTitle.length} символов, оптимально 30–60`}>
                <Input value={tr.seoTitle} onChange={(e) => setTr("seoTitle", e.target.value)} maxLength={200} />
              </Field>
              <Field label="SEO-описание (meta description)" hint={`${tr.seoDescription.length} символов, оптимально 70–160`}>
                <Textarea rows={3} value={tr.seoDescription} onChange={(e) => setTr("seoDescription", e.target.value)} maxLength={500} />
              </Field>
              <Field label="Ключевые слова (через запятую)">
                <Input value={tr.seoKeywords} onChange={(e) => setTr("seoKeywords", e.target.value)} maxLength={300} />
              </Field>
              <Field
                label="«Короткий ответ» для AI-поиска (40–80 слов)"
                hint="Факты о товаре простыми словами: что это, состав, цена, как заказать. Пусто — соберётся автоматически."
              >
                <Textarea rows={4} value={tr.shortAnswer} onChange={(e) => setTr("shortAnswer", e.target.value)} maxLength={1500} />
              </Field>
              {productId && v.slug && (
                <a
                  href={localizedPath(lang, `/menu/${v.slug}`)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                >
                  Открыть страницу на сайте ({LOCALE_SHORT[lang]}) <ExternalLink className="size-3.5" />
                </a>
              )}
            </div>
            <SeoChecklist values={v} lang={lang} />
          </div>
        )}
      </div>

      <div className="sticky bottom-0 z-10 -mx-1 flex items-center justify-between gap-3 border-t border-border bg-background/95 px-1 py-3 backdrop-blur">
        <p className="text-xs text-muted-foreground">
          {missing.length > 0
            ? `Нет перевода: ${missing.map((l) => LOCALE_SHORT[l]).join(", ")}`
            : "Все 4 языка заполнены"}
        </p>
        <Button type="button" size="lg" onClick={submit} disabled={pending || uploading}>
          {pending ? "Сохранение…" : productId ? "Сохранить изменения" : "Создать товар"}
        </Button>
      </div>
    </div>
  );
}

function SeoChecklist({ values, lang }: { values: ProductFormValues; lang: AppLocale }) {
  const t = values.translations[lang];
  const checks = productSeoChecklist({ ...t, hasImage: values.images.length > 0 });
  const done = checks.filter((c) => c.ok).length;
  return (
    <aside className="rounded-lg border border-border bg-muted/40 p-4">
      <p className="font-semibold">
        SEO-чеклист · {LOCALE_SHORT[lang]}{" "}
        <span className="text-sm font-normal text-muted-foreground">
          {done}/{checks.length}
        </span>
      </p>
      <ul className="mt-3 space-y-2 text-sm">
        {checks.map((check) => (
          <li key={check.id} className="flex gap-2">
            {check.ok ? (
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />
            ) : check.soft ? (
              <Circle className="mt-0.5 size-4 shrink-0 text-amber-500" />
            ) : (
              <TriangleAlert className="mt-0.5 size-4 shrink-0 text-destructive" />
            )}
            <span>
              {check.label}
              {check.hint && <span className="block text-xs text-muted-foreground">{check.hint}</span>}
            </span>
          </li>
        ))}
      </ul>
    </aside>
  );
}

function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-sm font-medium">{label}</p>
      {children}
      {error ? <p className="text-xs text-destructive">{error}</p> : hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Toggle({
  label,
  hint,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-lg border border-border p-3 text-sm">
      <span>
        <span className="font-medium">{label}</span>
        {hint && <span className="block text-xs text-muted-foreground">{hint}</span>}
      </span>
      <Switch checked={checked} disabled={disabled} onCheckedChange={onChange} />
    </label>
  );
}
