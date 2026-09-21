import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-4 text-center">
      <h1 className="font-display text-4xl font-bold text-primary">404</h1>
      <p className="text-muted-foreground">Страница не найдена</p>
      <Button asChild>
        <Link href="/">На главную</Link>
      </Button>
    </div>
  );
}
