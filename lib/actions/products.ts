"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/auth-guard";
import { productSchema } from "@/lib/validation";
import { getStorageAdapter, uploadImage, UploadValidationError } from "@/lib/uploads";
import type { Prisma } from "@/lib/generated/prisma/client";

export interface ActionResult {
  ok: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
  id?: string;
}

function safeJsonArray(value: FormDataEntryValue | null): unknown[] {
  if (typeof value !== "string" || !value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function parseProductForm(formData: FormData) {
  return productSchema.safeParse({
    name: formData.get("name"),
    slug: formData.get("slug"),
    description: formData.get("description") ?? "",
    shortDescription: formData.get("shortDescription") ?? "",
    categoryId: formData.get("categoryId"),
    type: formData.get("type"),
    price: formData.get("price"),
    oldPrice: formData.get("oldPrice") || null,
    isAlcohol: formData.get("isAlcohol") === "on",
    isVegetarian: formData.get("isVegetarian") === "on",
    isSpicy: formData.get("isSpicy") === "on",
    isActive: formData.get("isActive") === "on",
    isFeatured: formData.get("isFeatured") === "on",
    sku: formData.get("sku") ?? "",
    sortOrder: formData.get("sortOrder") || 0,
    stock: formData.get("stock") || null,
    ingredients: safeJsonArray(formData.get("ingredients")),
    variants: safeJsonArray(formData.get("variants")),
    seoTitle: formData.get("seoTitle") ?? "",
    seoDescription: formData.get("seoDescription") ?? "",
    seoKeywords: formData.get("seoKeywords") ?? "",
  });
}

function flatten(error: import("zod").ZodError): Record<string, string> {
  const result: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path[0]?.toString() ?? "form";
    if (!result[key]) result[key] = issue.message;
  }
  return result;
}

async function handleImages(formData: FormData) {
  const mainImageFile = formData.get("mainImage");
  let imageUrl = (formData.get("existingImageUrl") as string) || null;

  if (mainImageFile instanceof File && mainImageFile.size > 0) {
    const uploaded = await uploadImage(mainImageFile, "products");
    imageUrl = uploaded.url;
  }

  const keptGallery = safeJsonArray(formData.get("existingGalleryUrls")) as string[];
  const newGalleryFiles = formData.getAll("galleryImages").filter(
    (f): f is File => f instanceof File && f.size > 0
  );
  const uploadedGallery: string[] = [];
  for (const file of newGalleryFiles) {
    const uploaded = await uploadImage(file, "products");
    uploadedGallery.push(uploaded.url);
  }

  const galleryUrls = [...keptGallery, ...uploadedGallery];
  if (imageUrl && !galleryUrls.includes(imageUrl)) {
    galleryUrls.unshift(imageUrl);
  }

  return { imageUrl, galleryUrls };
}

export async function createProduct(formData: FormData): Promise<ActionResult> {
  await requireAdminSession();
  const parsed = parseProductForm(formData);
  if (!parsed.success) {
    return { ok: false, error: "Проверьте поля формы", fieldErrors: flatten(parsed.error) };
  }

  const existing = await prisma.product.findUnique({ where: { slug: parsed.data.slug } });
  if (existing) {
    return { ok: false, fieldErrors: { slug: "Такой slug уже используется" } };
  }

  let images: { imageUrl: string | null; galleryUrls: string[] };
  try {
    images = await handleImages(formData);
  } catch (error) {
    if (error instanceof UploadValidationError) {
      return { ok: false, error: error.message };
    }
    throw error;
  }

  const { variants, ...rest } = parsed.data;

  const product = await prisma.product.create({
    data: {
      ...rest,
      oldPrice: parsed.data.oldPrice ?? null,
      stock: parsed.data.stock ?? null,
      imageUrl: images.imageUrl,
      galleryUrls: images.galleryUrls as unknown as Prisma.InputJsonValue,
      ingredients: parsed.data.ingredients as unknown as Prisma.InputJsonValue,
      variants: (variants && variants.length > 0
        ? variants
        : undefined) as unknown as Prisma.InputJsonValue,
    },
  });

  revalidatePath("/admin/products");
  revalidatePath("/menu");
  return { ok: true, id: product.id };
}

export async function updateProduct(id: string, formData: FormData): Promise<ActionResult> {
  await requireAdminSession();
  const parsed = parseProductForm(formData);
  if (!parsed.success) {
    return { ok: false, error: "Проверьте поля формы", fieldErrors: flatten(parsed.error) };
  }

  const existing = await prisma.product.findFirst({
    where: { slug: parsed.data.slug, NOT: { id } },
  });
  if (existing) {
    return { ok: false, fieldErrors: { slug: "Такой slug уже используется" } };
  }

  const current = await prisma.product.findUnique({ where: { id } });
  if (!current) return { ok: false, error: "Товар не найден" };

  let images: { imageUrl: string | null; galleryUrls: string[] };
  try {
    images = await handleImages(formData);
  } catch (error) {
    if (error instanceof UploadValidationError) {
      return { ok: false, error: error.message };
    }
    throw error;
  }

  if (current.imageUrl && current.imageUrl !== images.imageUrl && current.imageUrl.startsWith("/uploads/")) {
    await getStorageAdapter().remove(current.imageUrl.replace("/uploads/", ""));
  }

  const { variants, ...rest } = parsed.data;

  await prisma.product.update({
    where: { id },
    data: {
      ...rest,
      oldPrice: parsed.data.oldPrice ?? null,
      stock: parsed.data.stock ?? null,
      imageUrl: images.imageUrl,
      galleryUrls: images.galleryUrls as unknown as Prisma.InputJsonValue,
      ingredients: parsed.data.ingredients as unknown as Prisma.InputJsonValue,
      variants: (variants && variants.length > 0
        ? variants
        : undefined) as unknown as Prisma.InputJsonValue,
    },
  });

  revalidatePath("/admin/products");
  revalidatePath(`/menu/${parsed.data.slug}`);
  revalidatePath("/menu");
  return { ok: true, id };
}

export async function toggleProductActive(id: string, isActive: boolean): Promise<ActionResult> {
  await requireAdminSession();
  await prisma.product.update({ where: { id }, data: { isActive } });
  revalidatePath("/admin/products");
  revalidatePath("/menu");
  return { ok: true };
}

export async function deleteProduct(id: string): Promise<ActionResult> {
  await requireAdminSession();
  const usedInOrders = await prisma.orderItem.count({ where: { productId: id } });
  if (usedInOrders > 0) {
    return {
      ok: false,
      error: "Нельзя удалить товар: он есть в истории заказов. Скройте его вместо удаления.",
    };
  }
  await prisma.product.delete({ where: { id } });
  revalidatePath("/admin/products");
  revalidatePath("/menu");
  return { ok: true };
}
