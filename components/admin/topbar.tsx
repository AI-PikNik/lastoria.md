import { signOutAction } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";

export function AdminTopbar({ email }: { email: string }) {
  return (
    <header className="flex h-14 items-center justify-between border-b border-border bg-card px-6">
      <span className="text-sm text-muted-foreground">{email}</span>
      <form action={signOutAction}>
        <Button type="submit" variant="outline" size="sm">
          Выйти
        </Button>
      </form>
    </header>
  );
}
