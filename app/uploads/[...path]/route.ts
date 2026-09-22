import { readFile, stat } from "node:fs/promises";
import path from "node:path";

/**
 * Запасная раздача загруженных файлов. Обычно /uploads/* отдаёт Nginx или
 * сам Next.js из папки public/, но файлы, добавленные после `next build`,
 * в некоторых конфигурациях не видны — тогда запрос доходит сюда.
 */
const ROOT = path.join(process.cwd(), "public", "uploads");

const TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

export async function GET(_request: Request, { params }: RouteContext<"/uploads/[...path]">) {
  const { path: parts } = await params;
  const filePath = path.normalize(path.join(ROOT, ...parts));
  const type = TYPES[path.extname(filePath).toLowerCase()];
  if (!filePath.startsWith(ROOT + path.sep) || !type) {
    return new Response("Not found", { status: 404 });
  }
  try {
    const info = await stat(filePath);
    if (!info.isFile()) return new Response("Not found", { status: 404 });
    const body = await readFile(filePath);
    return new Response(new Uint8Array(body), {
      headers: {
        "Content-Type": type,
        "Content-Length": String(info.size),
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; sandbox",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
