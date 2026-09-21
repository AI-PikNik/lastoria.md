"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { createCategory, updateCategory, type ActionResult } from "@/lib/actions/categories";
import { slugify } from "@/lib/slug";

interface CategoryData {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
  seoTitle: string | null;
  seoDescription: string | null;
}

export function CategoryFormDialog({
  category,
  trigger,
}: {
  category?: CategoryData;
  trigger: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [slug, setSlug] = React.useState(category?.slug ?? "");
  const [slugTouched, setSlugTouched] = React.useState(Boolean(category));
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [pending, setPending] = React.useState(false);

  const handleSubmit = async (formData: FormData) => {
    setPending(true);
    setErrors({});
    formData.set("slug", slug);
    const result: ActionResult = category
      ? await updateCategory(category.id, formData)
      : await createCategory(formData);
    setPending(false);

    if (!result.ok) {
      setErrors(result.fieldErrors ?? {});
      if (result.error) toast.error(result.error);
      return;
    }

    toast.success(category ? "Категория обновлена" : "Категория создана");
    setOpen(false);
    router.refresh();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{category ? "Редактировать категорию" : "Новая категория"}</DialogTitle>
        </DialogHeader>
        <form action={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name">Название</Label>
            <Input
              id="name"
              name="name"
              defaultValue={category?.name}
              required
              onChange={(e) => {
                if (!slugTouched) setSlug(slugify(e.target.value));
              }}
            />
            {errors.name && <p className="mt-1 text-xs text-destructive">{errors.name}</p>}
          </div>
          <div>
            <Label htmlFor="slug">Slug (URL)</Label>
            <Input
              id="slug"
              name="slug"
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
            <Label htmlFor="description">Описание</Label>
            <Textarea id="description" name="description" defaultValue={category?.description ?? ""} />
          </div>
          <div>
            <Label htmlFor="sortOrder">Порядок сортировки</Label>
            <Input
              id="sortOrder"
              name="sortOrder"
              type="number"
              defaultValue={category?.sortOrder ?? 0}
            />
          </div>
          <div>
            <Label htmlFor="seoTitle">SEO Title</Label>
            <Input id="seoTitle" name="seoTitle" defaultValue={category?.seoTitle ?? ""} />
          </div>
          <div>
            <Label htmlFor="seoDescription">SEO Description</Label>
            <Textarea id="seoDescription" name="seoDescription" defaultValue={category?.seoDescription ?? ""} />
          </div>
          <div className="flex items-center gap-2">
            <Switch id="isActive" name="isActive" defaultChecked={category?.isActive ?? true} />
            <Label htmlFor="isActive">Активна (видна на сайте)</Label>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Сохранение…" : "Сохранить"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
