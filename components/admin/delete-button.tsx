"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ActionResult } from "@/lib/actions/categories";

export function DeleteButton({
  action,
  confirmText = "Удалить?",
}: {
  action: () => Promise<ActionResult>;
  confirmText?: string;
}) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);

  const handleClick = async () => {
    if (!window.confirm(confirmText)) return;
    setPending(true);
    const result = await action();
    setPending(false);
    if (!result.ok) {
      toast.error(result.error ?? "Не удалось удалить");
      return;
    }
    toast.success("Удалено");
    router.refresh();
  };

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      disabled={pending}
      onClick={handleClick}
      aria-label="Удалить"
    >
      <Trash2 className="h-4 w-4 text-destructive" />
    </Button>
  );
}
