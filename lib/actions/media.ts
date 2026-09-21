"use server";

import { readdir, stat, unlink } from "node:fs/promises";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { requireAdminSession } from "@/lib/auth-guard";

const UPLOADS_ROOT = path.join(process.cwd(), "public", "uploads");

export interface MediaFile {
  key: string;
  url: string;
  size: number;
  updatedAt: string;
}

export async function listMediaFiles(): Promise<MediaFile[]> {
  await requireAdminSession();

  async function walk(dir: string, prefix: string): Promise<MediaFile[]> {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return [];
    }

    const files: MediaFile[] = [];
    for (const entry of entries) {
      if (entry.name.startsWith(".")) continue;
      const fullPath = path.join(dir, entry.name);
      const key = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        files.push(...(await walk(fullPath, key)));
      } else {
        const info = await stat(fullPath);
        files.push({
          key,
          url: `/uploads/${key}`,
          size: info.size,
          updatedAt: info.mtime.toISOString(),
        });
      }
    }
    return files;
  }

  const files = await walk(UPLOADS_ROOT, "");
  return files.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
}

export async function deleteMediaFile(key: string): Promise<{ ok: boolean; error?: string }> {
  await requireAdminSession();
  try {
    await unlink(path.join(UPLOADS_ROOT, key));
  } catch {
    return { ok: false, error: "Не удалось удалить файл" };
  }
  revalidatePath("/admin/media");
  return { ok: true };
}
