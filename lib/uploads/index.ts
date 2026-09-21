import { ALLOWED_UPLOAD_MIME_TYPES, MAX_UPLOAD_SIZE_BYTES } from "@/lib/constants";
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
