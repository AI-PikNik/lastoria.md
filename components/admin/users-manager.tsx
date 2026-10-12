"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { KeyRound, Pencil, Plus, Trash2 } from "lucide-react";
import { createUser, deleteUser, updateUser } from "@/lib/actions/users";
import { formatDateTime } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";

type Role = "ADMIN" | "MANAGER";

export interface StaffRow {
  id: string;
  name: string;
  email: string;
  role: Role;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

const ROLE_LABEL: Record<Role, string> = { ADMIN: "Администратор", MANAGER: "Оператор" };

export function UsersManager({ users, currentUserId }: { users: StaffRow[]; currentUserId: string }) {
  const router = useRouter();
  const [editing, setEditing] = React.useState<StaffRow | "new" | null>(null);

  const remove = async (user: StaffRow) => {
    if (!window.confirm(`Удалить сотрудника ${user.name} (${user.email})?`)) return;
    const result = await deleteUser(user.id);
    if (!result.ok) toast.error(result.error);
    else toast.success("Сотрудник удалён");
    router.refresh();
  };

  return (
    <div className="space-y-4">
      <Button onClick={() => setEditing("new")}>
        <Plus /> Добавить сотрудника
      </Button>

      <ul className="divide-y divide-border rounded-xl border border-border bg-card">
        {users.map((user) => (
          <li key={user.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
            <div className="min-w-48 flex-1">
              <p className="flex flex-wrap items-center gap-2 font-medium">
                {user.name}
                {user.id === currentUserId && <Badge variant="secondary">это вы</Badge>}
                <Badge variant={user.role === "ADMIN" ? "default" : "outline"}>{ROLE_LABEL[user.role]}</Badge>
                {!user.isActive && <Badge variant="warning">отключён</Badge>}
              </p>
              <p className="text-xs text-muted-foreground">
                {user.email} · последний вход: {user.lastLoginAt ? formatDateTime(user.lastLoginAt) : "ещё не входил"}
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={() => setEditing(user)}>
              <Pencil /> Изменить
            </Button>
            {user.id !== currentUserId && (
              <Button variant="ghost" size="sm" onClick={() => remove(user)} title="Удалить">
                <Trash2 className="text-destructive" />
              </Button>
            )}
          </li>
        ))}
      </ul>

      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-w-lg">
          {editing && (
            <UserForm
              user={editing === "new" ? null : editing}
              isSelf={editing !== "new" && editing.id === currentUserId}
              onDone={() => {
                setEditing(null);
                router.refresh();
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function UserForm({ user, isSelf, onDone }: { user: StaffRow | null; isSelf: boolean; onDone: () => void }) {
  const [name, setName] = React.useState(user?.name ?? "");
  const [email, setEmail] = React.useState(user?.email ?? "");
  const [role, setRole] = React.useState<Role>(user?.role ?? "MANAGER");
  const [isActive, setIsActive] = React.useState(user?.isActive ?? true);
  const [password, setPassword] = React.useState("");
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [pending, setPending] = React.useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setPending(true);
    const result = user
      ? await updateUser(user.id, { name, email, role, isActive, password })
      : await createUser({ name, email, role, password });
    setPending(false);
    if (!result.ok) {
      setErrors(result.fieldErrors ?? {});
      toast.error(result.error ?? Object.values(result.fieldErrors ?? {})[0] ?? "Ошибка");
      return;
    }
    toast.success(user ? "Сохранено" : "Сотрудник добавлен");
    onDone();
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <DialogHeader>
        <DialogTitle>{user ? "Сотрудник" : "Новый сотрудник"}</DialogTitle>
      </DialogHeader>
      <label className="block space-y-1 text-sm font-medium">
        Имя
        <Input value={name} onChange={(e) => setName(e.target.value)} required />
        {errors.name && <span className="block text-xs text-destructive">{errors.name}</span>}
      </label>
      <label className="block space-y-1 text-sm font-medium">
        Email (логин для входа)
        <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        {errors.email && <span className="block text-xs text-destructive">{errors.email}</span>}
      </label>
      <label className="block space-y-1 text-sm font-medium">
        Роль
        <NativeSelect value={role} onChange={(e) => setRole(e.target.value as Role)} disabled={isSelf}>
          <option value="MANAGER">Оператор — только дашборд и заказы</option>
          <option value="ADMIN">Администратор — полный доступ</option>
        </NativeSelect>
      </label>
      <label className="block space-y-1 text-sm font-medium">
        <span className="flex items-center gap-1">
          <KeyRound className="size-4" /> {user ? "Новый пароль (пусто — не менять)" : "Пароль"}
        </span>
        <Input
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={user ? undefined : 8}
          required={!user}
          placeholder="минимум 8 символов"
        />
        {errors.password && <span className="block text-xs text-destructive">{errors.password}</span>}
      </label>
      {user && (
        <label className="flex items-center justify-between rounded-lg border border-border p-3 text-sm">
          <span>
            <span className="font-medium">Может входить в админку</span>
            <span className="block text-xs text-muted-foreground">Отключите вместо удаления, если сотрудник временно не работает</span>
          </span>
          <Switch checked={isActive} onCheckedChange={setIsActive} disabled={isSelf} />
        </label>
      )}
      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? "Сохранение…" : "Сохранить"}
        </Button>
      </div>
    </form>
  );
}
