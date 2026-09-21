"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="ru">
      <body className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background text-foreground">
        <h1 className="font-display text-2xl font-bold">Что-то пошло не так</h1>
        <p className="text-muted-foreground">Попробуйте обновить страницу</p>
        <Button onClick={() => reset()}>Повторить</Button>
      </body>
    </html>
  );
}
