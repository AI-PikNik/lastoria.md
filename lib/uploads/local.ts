import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { StorageAdapter, UploadResult } from "./types";

const UPLOADS_ROOT = path.join(process.cwd(), "public", "uploads");

function extensionFromMime(mime: string): string {
  switch (mime) {
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "image/svg+xml":
      return "svg";
    case "image/x-icon":
    case "image/vnd.microsoft.icon":
      return "ico";
    default:
      return "bin";
  }
}

export class LocalStorageAdapter implements StorageAdapter {
  async upload(file: File, folder = "products"): Promise<UploadResult> {
    const dir = path.join(UPLOADS_ROOT, folder);
    await mkdir(dir, { recursive: true });

    const ext = extensionFromMime(file.type);
    const filename = `${randomUUID()}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(path.join(dir, filename), buffer);

    const key = `${folder}/${filename}`;
    return {
      url: `/uploads/${key}`,
      key,
      contentType: file.type,
      size: file.size,
    };
  }

  async remove(key: string): Promise<void> {
    try {
      await unlink(path.join(UPLOADS_ROOT, key));
    } catch {
      // файл уже отсутствует — не критично
    }
  }
}
