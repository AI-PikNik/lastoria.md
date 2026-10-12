import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export type StaffRole = "ADMIN" | "MANAGER";

export interface StaffUser {
  id: string;
  email: string;
  name: string;
  role: StaffRole;
}

/**
 * Текущий сотрудник. Роль и активность проверяются по базе на каждом
 * запросе — если пользователя удалили, отключили или сменили роль,
 * это действует сразу, без повторного входа.
 */
export const getStaffUser = cache(async (): Promise<StaffUser | null> => {
  const session = await auth();
  if (!session?.user?.id) return null;
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, email: true, name: true, role: true, isActive: true },
  });
  if (!user || !user.isActive) return null;
  return { id: user.id, email: user.email, name: user.name, role: user.role };
});

/** Любой сотрудник: администратор или оператор (дашборд, заказы) */
export async function requireStaff(): Promise<StaffUser> {
  const user = await getStaffUser();
  if (!user) redirect("/admin/login");
  return user;
}

/** Только администратор. Оператора отправляем к заказам. */
export async function requireAdmin(): Promise<StaffUser> {
  const user = await requireStaff();
  if (user.role !== "ADMIN") redirect("/admin/orders");
  return user;
}

/** Совместимость: все server actions каталога/настроек — только для администратора */
export const requireAdminSession = requireAdmin;
