import {
  ALLOWED_BRAND_MIME_TYPES,
  ALLOWED_UPLOAD_MIME_TYPES,
  MAX_UPLOAD_SIZE_BYTES,
} from "@/lib/constants";
import { LocalStorageAdapter } from "./local";
import { S3StorageAdapter } from "./s3";
import type { StorageAdapter, UploadResult } from "./types";

export type { StorageAdapter, UploadResult } from "./types";

let adapter: StorageAdapter | undefined;

export function getStorageAdapter(): StorageAdapter {
  if (adapter) return adapter;

  adapter =
    process.env.UPLOAD_PROVIDER === "s3"
      ? new S3StorageAdapter()
      : new LocalStorageAdapter();

  return adapter;
}

export class UploadValidationError extends Error {}

export function validateImageFile(file: File) {
  if (!ALLOWED_UPLOAD_MIME_TYPES.includes(file.type)) {
    throw new UploadValidationError(
      "Допустимые форматы изображений: JPG, PNG, WEBP"
    );
  }
  if (file.size > MAX_UPLOAD_SIZE_BYTES) {
    throw new UploadValidationError("Максимальный размер файла — 5 МБ");
  }
}

export async function uploadImage(
  file: File,
  folder = "products"
): Promise<UploadResult> {
  validateImageFile(file);
  return getStorageAdapter().upload(file, folder);
}

/** Логотип / favicon: дополнительно SVG и ICO, до 1 МБ */
export async function uploadBrandFile(file: File): Promise<UploadResult> {
  if (!ALLOWED_BRAND_MIME_TYPES.includes(file.type)) {
    throw new UploadValidationError("Допустимые форматы: JPG, PNG, WEBP, SVG, ICO");
  }
  if (file.size > 1024 * 1024) {
    throw new UploadValidationError("Максимальный размер логотипа/иконки — 1 МБ");
  }
  return getStorageAdapter().upload(file, "brand");
}

/** Ключ файла в хранилище по его публичному URL (/uploads/products/x.jpg → products/x.jpg) */
export function uploadKeyFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith("/uploads/")) return url.slice("/uploads/".length);
  const s3Base = process.env.S3_PUBLIC_URL?.replace(/\/$/, "");
  if (s3Base && url.startsWith(`${s3Base}/`)) return url.slice(s3Base.length + 1);
  return null;
}
