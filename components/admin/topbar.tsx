import { signOutAction } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";

export function AdminTopbar({ name, email, role }: { name: string; email: string; role: "ADMIN" | "MANAGER" }) {
  return (
    <header className="flex h-14 items-center justify-between gap-3 border-b border-border bg-card px-4 md:px-6">
      <span className="truncate text-sm text-muted-foreground">
        {name} · {email} ·{" "}
        <span className="font-medium text-foreground">{role === "ADMIN" ? "Администратор" : "Оператор"}</span>
      </span>
      <form action={signOutAction}>
        <Button type="submit" variant="outline" size="sm">
          Выйти
        </Button>
      </form>
    </header>
  );
}
