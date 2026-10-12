/**
 * Администратор из .env (ADMIN_EMAIL / ADMIN_PASSWORD / ADMIN_NAME).
 *
 * Применяется при каждом запуске scripts/aapanel-update.sh и seed, но только
 * если пара email+пароль в .env ИЗМЕНИЛАСЬ с прошлого раза (в базе хранится
 * отпечаток SHA-256, а не сам пароль). Поэтому:
 *   - поменяли пароль в .env → после обновления сайта он действует;
 *   - поменяли пароль в админке (Сотрудники) → обновление сайта его не затрёт,
 *     пока вы не поменяете .env.
 */
import { createHash } from "node:crypto";
import bcrypt from "bcryptjs";
import type { PrismaClient } from "@/lib/generated/prisma/client";

export type AdminSyncResult = "created" | "updated" | "unchanged" | "skipped";

export function adminEnvFingerprint(email: string, password: string): string {
  return createHash("sha256").update(`${email.trim().toLowerCase()}\n${password}`).digest("hex");
}

export async function syncAdminFromEnv(prisma: PrismaClient): Promise<{ result: AdminSyncResult; email: string }> {
  const email = (process.env.ADMIN_EMAIL ?? "").trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD ?? "";
  const name = process.env.ADMIN_NAME?.trim() || "Admin";
  if (!email || !password) return { result: "skipped", email };

  const fingerprint = adminEnvFingerprint(email, password);
  const settings = await prisma.settings.upsert({
    where: { id: "main" },
    update: {},
    create: { id: "main" },
    select: { adminEnvSyncedHash: true },
  });
  const existing = await prisma.user.findFirst({ where: { email: { equals: email, mode: "insensitive" } } });

  if (existing && settings.adminEnvSyncedHash === fingerprint) return { result: "unchanged", email };

  const passwordHash = await bcrypt.hash(password, 10);
  if (existing) {
    await prisma.user.update({
      where: { id: existing.id },
      data: { passwordHash, role: "ADMIN", isActive: true },
    });
  } else {
    await prisma.user.create({ data: { email, name, passwordHash, role: "ADMIN" } });
  }
  await prisma.settings.update({ where: { id: "main" }, data: { adminEnvSyncedHash: fingerprint } });
  return { result: existing ? "updated" : "created", email };
}
