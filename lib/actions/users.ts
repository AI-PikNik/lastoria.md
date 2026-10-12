"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-guard";
import { flattenZodError, userCreateSchema, userUpdateSchema } from "@/lib/validation";
import type { ActionResult } from "@/lib/action-result";

async function emailTaken(email: string, exceptId?: string) {
  const user = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" }, ...(exceptId ? { NOT: { id: exceptId } } : {}) },
  });
  return !!user;
}

/** Нельзя оставить сайт без активного администратора */
async function otherActiveAdmins(exceptId: string) {
  return prisma.user.count({ where: { role: "ADMIN", isActive: true, NOT: { id: exceptId } } });
}

export async function createUser(raw: unknown): Promise<ActionResult> {
  await requireAdmin();
  const parsed = userCreateSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Проверьте поля", fieldErrors: flattenZodError(parsed.error) };
  if (await emailTaken(parsed.data.email)) return { ok: false, fieldErrors: { email: "Такой email уже есть" } };

  await prisma.user.create({
    data: {
      name: parsed.data.name,
      email: parsed.data.email,
      role: parsed.data.role,
      passwordHash: await bcrypt.hash(parsed.data.password, 10),
    },
  });
  revalidatePath("/admin/users");
  return { ok: true };
}

export async function updateUser(id: string, raw: unknown): Promise<ActionResult> {
  const me = await requireAdmin();
  const parsed = userUpdateSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Проверьте поля", fieldErrors: flattenZodError(parsed.error) };
  const d = parsed.data;
  if (await emailTaken(d.email, id)) return { ok: false, fieldErrors: { email: "Такой email уже есть" } };

  const losesAdmin = d.role !== "ADMIN" || !d.isActive;
  if (id === me.id && losesAdmin) {
    return { ok: false, error: "Нельзя отключить себя или снять с себя роль администратора." };
  }
  if (losesAdmin && (await otherActiveAdmins(id)) === 0) {
    const target = await prisma.user.findUnique({ where: { id }, select: { role: true, isActive: true } });
    if (target?.role === "ADMIN" && target.isActive) {
      return { ok: false, error: "Это последний активный администратор — сначала назначьте другого." };
    }
  }

  await prisma.user.update({
    where: { id },
    data: {
      name: d.name,
      email: d.email,
      role: d.role,
      isActive: d.isActive,
      ...(d.password ? { passwordHash: await bcrypt.hash(d.password, 10) } : {}),
    },
  });
  revalidatePath("/admin/users");
  return { ok: true };
}

export async function deleteUser(id: string): Promise<ActionResult> {
  const me = await requireAdmin();
  if (id === me.id) return { ok: false, error: "Нельзя удалить самого себя." };
  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) return { ok: false, error: "Пользователь не найден" };
  if (target.role === "ADMIN" && target.isActive && (await otherActiveAdmins(id)) === 0) {
    return { ok: false, error: "Это последний активный администратор." };
  }
  await prisma.user.delete({ where: { id } });
  revalidatePath("/admin/users");
  return { ok: true };
}
