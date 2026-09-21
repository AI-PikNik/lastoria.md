"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { X, Plus, Upload } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createProduct, updateProduct } from "@/lib/actions/products";
import { slugify } from "@/lib/slug";
import { PRODUCT_TYPE_LABELS } from "@/lib/constants";

interface Category {
  id: string;
  name: string;
}

interface VariantRow {
  name: string;
  priceDelta: number;
}

interface ProductData {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  shortDescription: string | null;
  categoryId: string;
  type: string;
  price: number;
  oldPrice: number | null;
  isAlcohol: boolean;
  isVegetarian: boolean;
  isSpicy: boolean;
  isActive: boolean;
  isFeatured: boolean;
  sku: string | null;
  sortOrder: number;
  stock: number | null;
  imageUrl: string | null;
  galleryUrls: string[];
  ingredients: string[];
  variants: VariantRow[];
  seoTitle: string | null;
  seoDescription: string | null;
  seoKeywords: string | null;
}

const PRODUCT_TYPES = Object.entries(PRODUCT_TYPE_LABELS);

export function ProductForm({
  product,
  categories,
}: {
  product?: ProductData;
  categories: Category[];
}) {
  const router = useRouter();
  const [name, setName] = React.useState(product?.name ?? "");
  const [slug, setSlug] = React.useState(product?.slug ?? "");
  const [slugTouched, setSlugTouched] = React.useState(Boolean(product));
  const [categoryId, setCategoryId] = React.useState(product?.categoryId ?? categories[0]?.id ?? "");
  const [type, setType] = React.useState(product?.type ?? "PIZZA");
  const [ingredients, setIngredients] = React.useState(
    (product?.ingredients ?? []).join(", ")
  );
  const [variants, setVariants] = React.useState<VariantRow[]>(product?.variants ?? []);
  const [mainImageFile, setMainImageFile] = React.useState<File | null>(null);
  const [mainImagePreview, setMainImagePreview] = React.useState<string | null>(
    product?.imageUrl ?? null
  );
  const [existingGallery, setExistingGallery] = React.useState<string[]>(
    (product?.galleryUrls ?? []).filter((url) => url !== product?.imageUrl)
  );
  const [newGalleryFiles, setNewGalleryFiles] = React.useState<File[]>([]);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  const newGalleryPreviews = React.useMemo(
    () => newGalleryFiles.map((f) => URL.createObjectURL(f)),
    [newGalleryFiles]
  );

  const addVariant = () => setVariants((v) => [...v, { name: "", priceDelta: 0 }]);
  const removeVariant = (index: number) =>
    setVariants((v) => v.filter((_, i) => i !== index));
  const updateVariant = (index: number, patch: Partial<VariantRow>) =>
    setVariants((v) => v.map((row, i) => (i === index ? { ...row, ...patch } : row)));

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPending(true);
    setErrors({});
    setFormError(null);

    const formData = new FormData(event.currentTarget);
    formData.set("slug", slug);
    formData.set("categoryId", categoryId);
    formData.set("type", type);
    formData.set(
      "ingredients",
      JSON.stringify(
        ingredients
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      )
    );
    formData.set(
      "variants",
      JSON.stringify(variants.filter((v) => v.name.trim().length > 0))
    );
    formData.set("existingGalleryUrls", JSON.stringify(existingGallery));
    formData.set("existingImageUrl", mainImagePreview ?? "");
    if (mainImageFile) formData.set("mainImage", mainImageFile);
    formData.delete("galleryImages");
    for (const file of newGalleryFiles) formData.append("galleryImages", file);

    const result = product
      ? await updateProduct(product.id, formData)
      : await createProduct(formData);

    setPending(false);

    if (!result.ok) {
      setErrors(result.fieldErrors ?? {});
      setFormError(result.error ?? null);
      toast.error(result.error ?? "Проверьте форму");
      return;
    }

    toast.success(product ? "Товар обновлён" : "Товар создан");
    router.push("/admin/products");
    router.refresh();
  };

  return (
    <form onSubmit={handleSubmit} className="grid gap-8 lg:grid-cols-[2fr_1fr]">
      <div className="space-y-6">
        <section className="space-y-4 rounded-xl border border-border bg-card p-6">
          <h2 className="font-display font-semibold">Основное</h2>

          <div>
            <Label htmlFor="name">Название</Label>
            <Input
              id="name"
              name="name"
              value={name}
              required
              onChange={(e) => {
                setName(e.target.value);
                if (!slugTouched) setSlug(slugify(e.target.value));
              }}
            />
            {errors.name && <p className="mt-1 text-xs text-destructive">{errors.name}</p>}
          </div>

          <div>
            <Label htmlFor="slug">Slug (URL)</Label>
            <Input
              id="slug"
              value={slug}
              onChange={(e) => {
                setSlug(e.target.value);
                setSlugTouched(true);
              }}
              required
            />
            {errors.slug && <p className="mt-1 text-xs text-destructive">{errors.slug}</p>}
          </div>

          <div>
            <Label htmlFor="shortDescription">Короткое описание</Label>
            <Textarea
              id="shortDescription"
              name="shortDescription"
              rows={2}
              defaultValue={product?.shortDescription ?? ""}
            />
          </div>

          <div>
            <Label htmlFor="description">Полное описание (Markdown)</Label>
            <Textarea
              id="description"
              name="description"
              rows={6}
              defaultValue={product?.description ?? ""}
            />
          </div>

          <div>
            <Label htmlFor="ingredients">Состав (через запятую)</Label>
            <Textarea
              id="ingredients"
              rows={2}
              value={ingredients}
              onChange={(e) => setIngredients(e.target.value)}
              placeholder="моцарелла, томатный соус, базилик"
            />
          </div>
        </section>

        <section className="space-y-4 rounded-xl border border-border bg-card p-6">
          <h2 className="font-display font-semibold">Варианты (размер / объём)</h2>
          {variants.map((variant, index) => (
            <div key={index} className="flex items-center gap-2">
              <Input
                placeholder="Название, напр. 35 см"
                value={variant.name}
                onChange={(e) => updateVariant(index, { name: e.target.value })}
              />
              <Input
                type="number"
                placeholder="Доплата, MDL"
                className="w-40"
                value={variant.priceDelta}
                onChange={(e) => updateVariant(index, { priceDelta: Number(e.target.value) })}
              />
              <Button type="button" variant="ghost" size="icon" onClick={() => removeVariant(index)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" onClick={addVariant}>
            <Plus className="h-4 w-4" /> Добавить вариант
          </Button>
        </section>

        <section className="space-y-4 rounded-xl border border-border bg-card p-6">
          <h2 className="font-display font-semibold">SEO</h2>
          <div>
            <Label htmlFor="seoTitle">SEO Title</Label>
            <Input id="seoTitle" name="seoTitle" defaultValue={product?.seoTitle ?? ""} />
          </div>
          <div>
            <Label htmlFor="seoDescription">SEO Description</Label>
            <Textarea id="seoDescription" name="seoDescription" rows={2} defaultValue={product?.seoDescription ?? ""} />
          </div>
          <div>
            <Label htmlFor="seoKeywords">SEO Keywords</Label>
            <Input id="seoKeywords" name="seoKeywords" defaultValue={product?.seoKeywords ?? ""} />
          </div>
          <p className="text-xs text-muted-foreground">
            OG-картинка берётся из основного фото товара, если не задано отдельно.
          </p>
        </section>
      </div>

      <div className="space-y-6">
        <section className="space-y-4 rounded-xl border border-border bg-card p-6">
          <h2 className="font-display font-semibold">Цена и категория</h2>
          <div>
            <Label htmlFor="price">Цена, MDL</Label>
            <Input id="price" name="price" type="number" step="0.01" defaultValue={product?.price ?? ""} required />
            {errors.price && <p className="mt-1 text-xs text-destructive">{errors.price}</p>}
          </div>
          <div>
            <Label htmlFor="oldPrice">Старая цена (для скидки)</Label>
            <Input id="oldPrice" name="oldPrice" type="number" step="0.01" defaultValue={product?.oldPrice ?? ""} />
          </div>
          <div>
            <Label>Тип товара</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PRODUCT_TYPES.map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Категория</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.categoryId && <p className="mt-1 text-xs text-destructive">{errors.categoryId}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="sku">Артикул (SKU)</Label>
              <Input id="sku" name="sku" defaultValue={product?.sku ?? ""} />
            </div>
            <div>
              <Label htmlFor="stock">Остаток</Label>
              <Input id="stock" name="stock" type="number" defaultValue={product?.stock ?? ""} />
            </div>
          </div>
          <div>
            <Label htmlFor="sortOrder">Порядок сортировки</Label>
            <Input id="sortOrder" name="sortOrder" type="number" defaultValue={product?.sortOrder ?? 0} />
          </div>
        </section>

        <section className="space-y-3 rounded-xl border border-border bg-card p-6">
          <h2 className="font-display font-semibold">Флаги</h2>
          <FlagRow name="isActive" label="Активен (виден на сайте)" defaultChecked={product?.isActive ?? true} />
          <FlagRow name="isFeatured" label="Хит" defaultChecked={product?.isFeatured ?? false} />
          <FlagRow name="isAlcohol" label="Алкоголь (18+)" defaultChecked={product?.isAlcohol ?? false} />
          <FlagRow name="isVegetarian" label="Вегетарианское" defaultChecked={product?.isVegetarian ?? false} />
          <FlagRow name="isSpicy" label="Острое" defaultChecked={product?.isSpicy ?? false} />
        </section>

        <section className="space-y-3 rounded-xl border border-border bg-card p-6">
          <h2 className="font-display font-semibold">Главное фото</h2>
          {mainImagePreview && (
            <div className="relative aspect-square w-full overflow-hidden rounded-md bg-muted">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={mainImagePreview} alt="" className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => {
                  setMainImageFile(null);
                  setMainImagePreview(null);
                }}
                className="absolute right-2 top-2 rounded-full bg-black/60 p-1 text-white"
                aria-label="Удалить фото"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-input p-4 text-sm text-muted-foreground hover:bg-secondary">
            <Upload className="h-4 w-4" />
            {mainImagePreview ? "Заменить фото" : "Загрузить фото"}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setMainImageFile(file);
                setMainImagePreview(URL.createObjectURL(file));
              }}
            />
          </label>
          {formError && <p className="text-xs text-destructive">{formError}</p>}
        </section>

        <section className="space-y-3 rounded-xl border border-border bg-card p-6">
          <h2 className="font-display font-semibold">Галерея</h2>
          <div className="grid grid-cols-3 gap-2">
            {existingGallery.map((url) => (
              <div key={url} className="relative aspect-square overflow-hidden rounded-md bg-muted">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="" className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() => setExistingGallery((g) => g.filter((u) => u !== url))}
                  className="absolute right-1 top-1 rounded-full bg-black/60 p-0.5 text-white"
                  aria-label="Удалить из галереи"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
            {newGalleryPreviews.map((url, index) => (
              <div key={url} className="relative aspect-square overflow-hidden rounded-md bg-muted">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="" className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() => setNewGalleryFiles((files) => files.filter((_, i) => i !== index))}
                  className="absolute right-1 top-1 rounded-full bg-black/60 p-0.5 text-white"
                  aria-label="Убрать"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-input p-3 text-sm text-muted-foreground hover:bg-secondary">
            <Upload className="h-4 w-4" /> Добавить фото в галерею
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              className="hidden"
              onChange={(e) => {
                const files = Array.from(e.target.files ?? []);
                setNewGalleryFiles((prev) => [...prev, ...files]);
              }}
            />
          </label>
        </section>

        <Button type="submit" size="lg" className="w-full" disabled={pending}>
          {pending ? "Сохранение…" : product ? "Сохранить изменения" : "Создать товар"}
        </Button>
      </div>
    </form>
  );
}

function FlagRow({
  name,
  label,
  defaultChecked,
}: {
  name: string;
  label: string;
  defaultChecked: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <Label htmlFor={name} className="font-normal">
        {label}
      </Label>
      <Switch id={name} name={name} defaultChecked={defaultChecked} />
    </div>
  );
}
