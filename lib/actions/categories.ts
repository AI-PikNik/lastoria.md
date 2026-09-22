"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/auth-guard";
import { categorySchema, flattenZodError } from "@/lib/validation";
import { LOCALES } from "@/lib/i18n/locales";
import { revalidatePublicSite } from "@/lib/admin-data";
import type { ActionResult } from "@/lib/action-result";

function translationRows(input: ReturnType<typeof categorySchema.parse>) {
  return LOCALES.filter((l) => input.translations[l].name.length > 0).map((locale) => ({
    locale,
    name: input.translations[locale].name,
    description: input.translations[locale].description || null,
    seoTitle: input.translations[locale].seoTitle || null,
    seoDescription: input.translations[locale].seoDescription || null,
  }));
}

function done(): ActionResult {
  revalidatePath("/admin/categories");
  revalidatePath("/admin/products");
  revalidatePublicSite();
  return { ok: true };
}

export async function createCategory(raw: unknown): Promise<ActionResult> {
  await requireAdminSession();
  const parsed = categorySchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Проверьте поля формы", fieldErrors: flattenZodError(parsed.error) };

  if (await prisma.category.findUnique({ where: { slug: parsed.data.slug } })) {
    return { ok: false, fieldErrors: { slug: "Такой адрес (slug) уже используется" } };
  }
  const last = await prisma.category.aggregate({ _max: { sortOrder: true } });
  const category = await prisma.category.create({
    data: {
      slug: parsed.data.slug,
      kind: parsed.data.kind,
      requiresAgeConfirm: parsed.data.kind === "ALCOHOL" ? true : parsed.data.requiresAgeConfirm,
      isActive: parsed.data.isActive,
      imageUrl: parsed.data.imageUrl || null,
      sortOrder: (last._max.sortOrder ?? 0) + 1,
      translations: { create: translationRows(parsed.data) },
    },
  });
  return { ...done(), id: category.id };
}

export async function updateCategory(id: string, raw: unknown): Promise<ActionResult> {
  await requireAdminSession();
  const parsed = categorySchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Проверьте поля формы", fieldErrors: flattenZodError(parsed.error) };

  if (await prisma.category.findFirst({ where: { slug: parsed.data.slug, NOT: { id } } })) {
    return { ok: false, fieldErrors: { slug: "Такой адрес (slug) уже используется" } };
  }
  const rows = translationRows(parsed.data);
  await prisma.$transaction([
    prisma.category.update({
      where: { id },
      data: {
        slug: parsed.data.slug,
        kind: parsed.data.kind,
        requiresAgeConfirm: parsed.data.kind === "ALCOHOL" ? true : parsed.data.requiresAgeConfirm,
        isActive: parsed.data.isActive,
        imageUrl: parsed.data.imageUrl || null,
      },
    }),
    // Пустые языки удаляются — на сайте для них сработает fallback (ro → другой язык)
    prisma.categoryTranslation.deleteMany({
      where: { categoryId: id, locale: { notIn: rows.map((r) => r.locale) } },
    }),
    ...rows.map((row) =>
      prisma.categoryTranslation.upsert({
        where: { categoryId_locale: { categoryId: id, locale: row.locale } },
        update: row,
        create: { ...row, categoryId: id },
      })
    ),
  ]);
  return { ...done(), id };
}

export async function setCategoryActive(id: string, isActive: boolean): Promise<ActionResult> {
  await requireAdminSession();
  await prisma.category.update({ where: { id }, data: { isActive } });
  return done();
}

/** Порядок групп на сайте = порядок id в массиве */
export async function reorderCategories(ids: string[]): Promise<ActionResult> {
  await requireAdminSession();
  if (!Array.isArray(ids) || ids.some((id) => typeof id !== "string")) return { ok: false, error: "Неверные данные" };
  await prisma.$transaction(ids.map((id, index) => prisma.category.update({ where: { id }, data: { sortOrder: index + 1 } })));
  return done();
}

/** Удалить можно только пустую и не системную группу; иначе — скрыть */
export async function deleteCategory(id: string): Promise<ActionResult> {
  await requireAdminSession();
  const category = await prisma.category.findUnique({
    where: { id },
    include: { _count: { select: { products: true } } },
  });
  if (!category) return { ok: false, error: "Группа не найдена" };
  if (category.isSystem) {
    return { ok: false, error: "Стартовую группу нельзя удалить — её можно только скрыть." };
  }
  if (category._count.products > 0) {
    return {
      ok: false,
      error: `В группе ${category._count.products} товар(ов). Перенесите их в другую группу или скройте группу.`,
    };
  }
  await prisma.category.delete({ where: { id } });
  return done();
}
