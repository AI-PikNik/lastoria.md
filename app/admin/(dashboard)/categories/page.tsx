import { Plus } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { LOCALES, type AppLocale } from "@/lib/i18n/locales";
import { missingLocales } from "@/lib/i18n/translate";
import { adminName } from "@/lib/admin-data";
import { Button } from "@/components/ui/button";
import { CategoryEditor } from "@/components/admin/category-editor";
import { CategoryList, type CategoryRow } from "@/components/admin/category-list";

export const metadata = { title: "Группы товаров" };

export default async function AdminCategoriesPage() {
  const rows = await prisma.category.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    include: { translations: true, _count: { select: { products: true } } },
  });

  const categories: CategoryRow[] = rows.map((c) => {
    const byLocale = new Map(c.translations.map((t) => [t.locale as AppLocale, t]));
    return {
      id: c.id,
      slug: c.slug,
      kind: c.kind,
      isActive: c.isActive,
      isSystem: c.isSystem,
      requiresAgeConfirm: c.requiresAgeConfirm,
      imageUrl: c.imageUrl,
      name: adminName(c.translations, c.slug),
      productCount: c._count.products,
      missing: missingLocales(c.translations, "name"),
      translations: Object.fromEntries(
        LOCALES.map((l) => {
          const t = byLocale.get(l);
          return [
            l,
            {
              name: t?.name ?? "",
              description: t?.description ?? "",
              seoTitle: t?.seoTitle ?? "",
              seoDescription: t?.seoDescription ?? "",
            },
          ];
        })
      ) as CategoryRow["translations"],
    };
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">Группы товаров</h1>
          <p className="text-sm text-muted-foreground">
            Порядок здесь = порядок на сайте. Перетащите строку или используйте стрелки.
          </p>
        </div>
        <CategoryEditor
          trigger={
            <Button>
              <Plus /> Новая группа
            </Button>
          }
        />
      </div>
      <CategoryList categories={categories} />
      <p className="text-xs text-muted-foreground">
        Стартовые группы и группы с товарами удалить нельзя — их можно скрыть. Пустую свою группу можно удалить.
      </p>
    </div>
  );
}
