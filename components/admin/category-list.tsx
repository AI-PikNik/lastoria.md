"use client";

import * as React from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Eye, EyeOff, Pencil, Trash2 } from "lucide-react";
import { deleteCategory, reorderCategories, setCategoryActive } from "@/lib/actions/categories";
import { CATEGORY_KIND_LABELS } from "@/lib/constants";
import type { AppLocale } from "@/lib/i18n/locales";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CategoryEditor, type CategoryEditorData } from "./category-editor";
import { MissingBadge } from "./localized-fields";
import { SortableList } from "./sortable-list";

export interface CategoryRow extends CategoryEditorData {
  name: string;
  productCount: number;
  missing: AppLocale[];
}

export function CategoryList({ categories }: { categories: CategoryRow[] }) {
  const router = useRouter();
  const [items, setItems] = React.useState(categories);
  const [source, setSource] = React.useState(categories);
  if (source !== categories) {
    // новые данные с сервера (после router.refresh) — сбрасываем локальный порядок
    setSource(categories);
    setItems(categories);
  }

  const reorder = async (ids: string[]) => {
    const previous = items;
    setItems(ids.map((id) => items.find((c) => c.id === id)!));
    const result = await reorderCategories(ids);
    if (!result.ok) {
      setItems(previous);
      toast.error(result.error ?? "Не удалось сохранить порядок");
    } else {
      toast.success("Порядок групп сохранён");
    }
  };

  const toggle = async (category: CategoryRow) => {
    const result = await setCategoryActive(category.id, !category.isActive);
    if (!result.ok) toast.error(result.error);
    router.refresh();
  };

  const remove = async (category: CategoryRow) => {
    if (!window.confirm(`Удалить группу «${category.name}»?`)) return;
    const result = await deleteCategory(category.id);
    if (!result.ok) toast.error(result.error);
    else toast.success("Группа удалена");
    router.refresh();
  };

  return (
    <SortableList
      items={items}
      onReorder={reorder}
      className="overflow-hidden rounded-xl border border-border"
      renderItem={(category) => (
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative size-10 shrink-0 overflow-hidden rounded bg-muted">
            {category.imageUrl && <Image src={category.imageUrl} alt="" fill sizes="40px" className="object-cover" />}
          </div>
          <div className="min-w-40 flex-1">
            <p className="flex flex-wrap items-center gap-2 font-semibold">
              {category.name}
              {!category.isActive && <Badge variant="outline">скрыта</Badge>}
              {category.isSystem && <Badge variant="secondary">стартовая</Badge>}
              {category.requiresAgeConfirm && <Badge variant="dark">18+</Badge>}
            </p>
            <p className="text-xs text-muted-foreground">
              /menu/group/{category.slug} · {CATEGORY_KIND_LABELS[category.kind]} · товаров: {category.productCount}
            </p>
            {category.missing.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-1">
                {category.missing.map((l) => (
                  <MissingBadge key={l} locale={l} />
                ))}
              </div>
            )}
          </div>
          <div className="flex gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => toggle(category)}
              title={category.isActive ? "Скрыть с сайта" : "Показать на сайте"}
            >
              {category.isActive ? <EyeOff /> : <Eye />}
              <span className="hidden sm:inline">{category.isActive ? "Скрыть" : "Показать"}</span>
            </Button>
            <CategoryEditor
              category={category}
              trigger={
                <Button type="button" variant="outline" size="sm">
                  <Pencil /> Изменить
                </Button>
              }
            />
            {!category.isSystem && category.productCount === 0 && (
              <Button type="button" variant="ghost" size="sm" onClick={() => remove(category)} title="Удалить">
                <Trash2 className="text-destructive" />
              </Button>
            )}
          </div>
        </div>
      )}
    />
  );
}
