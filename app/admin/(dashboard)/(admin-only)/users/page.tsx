import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-guard";
import { UsersManager } from "@/components/admin/users-manager";

export const metadata = { title: "Сотрудники" };

export default async function AdminUsersPage() {
  const me = await requireAdmin();
  const users = await prisma.user.findMany({
    orderBy: [{ role: "asc" }, { createdAt: "asc" }],
    select: { id: true, name: true, email: true, role: true, isActive: true, lastLoginAt: true, createdAt: true },
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-2xl font-bold">Сотрудники</h1>
        <p className="text-sm text-muted-foreground">
          <strong>Администратор</strong> — полный доступ. <strong>Оператор</strong> — только дашборд и заказы:
          видит новые заказы, меняет статусы и редактирует состав заказа; каталог, цены, настройки ему недоступны.
        </p>
      </div>
      <UsersManager
        currentUserId={me.id}
        users={users.map((u) => ({
          ...u,
          lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
          createdAt: u.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}
