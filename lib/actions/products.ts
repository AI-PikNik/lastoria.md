"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/auth-guard";
import { flattenZodError, productSchema, type ProductInput } from "@/lib/validation";
import { getStorageAdapter, uploadImage, uploadKeyFromUrl, UploadValidationError } from "@/lib/uploads";
import { LOCALES } from "@/lib/i18n/locales";
import { revalidatePublicSite } from "@/lib/admin-data";
import type { ActionResult } from "@/lib/action-result";
import type { Prisma } from "@/lib/generated/prisma/client";

const json = (value: unknown) => value as Prisma.InputJsonValue;

function translationRows(input: ProductInput) {
  return LOCALES.filter((l) => input.translations[l].name.length > 0).map((locale) => {
    const t = input.translations[locale];
    return {
      locale,
      name: t.name,
      shortDescription: t.shortDescription || null,
      description: t.description || null,
      ingredientsText: t.ingredientsText || null,
      seoTitle: t.seoTitle || null,
      seoDescription: t.seoDescription || null,
      seoKeywords: t.seoKeywords || null,
      shortAnswer: t.shortAnswer || null,
      imageAlt: t.imageAlt || null,
    };
  });
}

function productData(input: ProductInput) {
  const images = input.images.filter((url, i, all) => url && all.indexOf(url) === i);
  return {
    slug: input.slug,
    categoryId: input.categoryId,
    price: input.price,
    oldPrice: input.oldPrice ?? null,
    isAlcohol: input.isAlcohol,
    isVegetarian: input.isVegetarian,
    isSpicy: input.isSpicy,
    isActive: input.isActive,
    isFeatured: input.isFeatured,
    sku: input.sku || null,
    sortOrder: input.sortOrder,
    stock: input.stock ?? null,
    // Первое фото — главное, все фото по порядку — галерея
    imageUrl: images[0] ?? null,
    galleryUrls: json(images),
    ogImageUrl: input.ogImageUrl || null,
    // Пустой список вариантов тоже сохраняется (раньше удалённые варианты «возвращались»)
    variants: json(input.variants),
  };
}

function done(slug?: string): void {
  revalidatePath("/admin/products");
  if (slug) revalidatePath(`/admin/products`, "layout");
  revalidatePublicSite();
}

/** Удаляет из хранилища фото, которые больше не используются ни одним товаром/группой/настройками */
async function removeUnusedImages(urls: string[]) {
  for (const url of urls) {
    const key = uploadKeyFromUrl(url);
    if (!key || key.startsWith("seed/")) continue;
    const [products, categories, settings] = await Promise.all([
      prisma.product.count({
        where: { OR: [{ imageUrl: url }, { ogImageUrl: url }, { galleryUrls: { array_contains: [url] } }] },
      }),
      prisma.category.count({ where: { imageUrl: url } }),
      prisma.settings.count({ where: { OR: [{ logoUrl: url }, { faviconUrl: url }, { heroImageUrl: url }] } }),
    ]);
    if (products + categories + settings === 0) await getStorageAdapter().remove(key);
  }
}

export async function createProduct(raw: unknown): Promise<ActionResult> {
  await requireAdminSession();
  const parsed = productSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Проверьте поля формы", fieldErrors: flattenZodError(parsed.error) };

  if (await prisma.product.findUnique({ where: { slug: parsed.data.slug } })) {
    return { ok: false, fieldErrors: { slug: "Такой адрес (slug) уже используется" } };
  }
  const product = await prisma.product.create({
    data: { ...productData(parsed.data), translations: { create: translationRows(parsed.data) } },
  });
  done(product.slug);
  return { ok: true, id: product.id };
}

export async function updateProduct(id: string, raw: unknown): Promise<ActionResult> {
  await requireAdminSession();
  const parsed = productSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Проверьте поля формы", fieldErrors: flattenZodError(parsed.error) };

  if (await prisma.product.findFirst({ where: { slug: parsed.data.slug, NOT: { id } } })) {
    return { ok: false, fieldErrors: { slug: "Такой адрес (slug) уже используется" } };
  }
  const current = await prisma.product.findUnique({ where: { id } });
  if (!current) return { ok: false, error: "Товар не найден" };

  const data = productData(parsed.data);
  const rows = translationRows(parsed.data);
  await prisma.$transaction([
    prisma.product.update({ where: { id }, data }),
    prisma.productTranslation.deleteMany({ where: { productId: id, locale: { notIn: rows.map((r) => r.locale) } } }),
    ...rows.map((row) =>
      prisma.productTranslation.upsert({
        where: { productId_locale: { productId: id, locale: row.locale } },
        update: row,
        create: { ...row, productId: id },
      })
    ),
  ]);

  // Фото, убранные из товара, удаляем с диска только после сохранения
  // (раньше старое фото удалялось, а страницы сайта ещё ссылались на него).
  const before = new Set<string>([
    ...(current.imageUrl ? [current.imageUrl] : []),
    ...(current.ogImageUrl ? [current.ogImageUrl] : []),
    ...(Array.isArray(current.galleryUrls) ? (current.galleryUrls as string[]) : []),
  ]);
  const after = new Set<string>([...(parsed.data.images ?? []), ...(data.ogImageUrl ? [data.ogImageUrl] : [])]);
  await removeUnusedImages([...before].filter((url) => !after.has(url)));

  done(parsed.data.slug);
  return { ok: true, id };
}

export async function toggleProductActive(id: string, isActive: boolean): Promise<ActionResult> {
  await requireAdminSession();
  await prisma.product.update({ where: { id }, data: { isActive } });
  done();
  return { ok: true };
}

export async function deleteProduct(id: string): Promise<ActionResult> {
  await requireAdminSession();
  const usedInOrders = await prisma.orderItem.count({ where: { productId: id } });
  if (usedInOrders > 0) {
    return { ok: false, error: "Нельзя удалить товар: он есть в истории заказов. Скройте его вместо удаления." };
  }
  const product = await prisma.product.delete({ where: { id } });
  await removeUnusedImages([
    ...(product.imageUrl ? [product.imageUrl] : []),
    ...(Array.isArray(product.galleryUrls) ? (product.galleryUrls as string[]) : []),
  ]);
  done();
  return { ok: true };
}

/** Загрузка фото сразу при выборе файла (форма товара потом сохраняет только ссылки) */
export async function uploadProductImages(formData: FormData): Promise<ActionResult> {
  await requireAdminSession();
  const files = formData.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) return { ok: false, error: "Файлы не выбраны" };
  if (files.length > 10) return { ok: false, error: "За один раз — не больше 10 фото" };
  const folder = formData.get("folder") === "categories" ? "categories" : "products";
  try {
    const urls: string[] = [];
    for (const file of files) urls.push((await uploadImage(file, folder)).url);
    revalidatePath("/admin/media");
    return { ok: true, urls };
  } catch (error) {
    if (error instanceof UploadValidationError) return { ok: false, error: error.message };
    throw error;
  }
}
