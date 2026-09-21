"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/auth-guard";
import { categorySchema } from "@/lib/validation";

export interface ActionResult {
  ok: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
}

function parseCategoryForm(formData: FormData) {
  return categorySchema.safeParse({
    name: formData.get("name"),
    slug: formData.get("slug"),
    description: formData.get("description") ?? "",
    sortOrder: formData.get("sortOrder") || 0,
    isActive: formData.get("isActive") === "on",
    seoTitle: formData.get("seoTitle") ?? "",
    seoDescription: formData.get("seoDescription") ?? "",
  });
}

export async function createCategory(formData: FormData): Promise<ActionResult> {
  await requireAdminSession();
  const parsed = parseCategoryForm(formData);
  if (!parsed.success) {
    return { ok: false, error: "Проверьте поля формы", fieldErrors: flatten(parsed.error) };
  }

  const existing = await prisma.category.findUnique({ where: { slug: parsed.data.slug } });
  if (existing) {
    return { ok: false, fieldErrors: { slug: "Такой slug уже используется" } };
  }

  await prisma.category.create({ data: parsed.data });
  revalidatePath("/admin/categories");
  revalidatePath("/menu");
  return { ok: true };
}

export async function updateCategory(id: string, formData: FormData): Promise<ActionResult> {
  await requireAdminSession();
  const parsed = parseCategoryForm(formData);
  if (!parsed.success) {
    return { ok: false, error: "Проверьте поля формы", fieldErrors: flatten(parsed.error) };
  }

  const existing = await prisma.category.findFirst({
    where: { slug: parsed.data.slug, NOT: { id } },
  });
  if (existing) {
    return { ok: false, fieldErrors: { slug: "Такой slug уже используется" } };
  }

  await prisma.category.update({ where: { id }, data: parsed.data });
  revalidatePath("/admin/categories");
  revalidatePath("/menu");
  return { ok: true };
}

export async function deleteCategory(id: string): Promise<ActionResult> {
  await requireAdminSession();
  const productsCount = await prisma.product.count({ where: { categoryId: id } });
  if (productsCount > 0) {
    return {
      ok: false,
      error: `Нельзя удалить категорию: в ней ${productsCount} товар(ов). Сначала перенесите или удалите товары.`,
    };
  }
  await prisma.category.delete({ where: { id } });
  revalidatePath("/admin/categories");
  revalidatePath("/menu");
  return { ok: true };
}

function flatten(error: import("zod").ZodError): Record<string, string> {
  const result: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path[0]?.toString() ?? "form";
    if (!result[key]) result[key] = issue.message;
  }
  return result;
}
