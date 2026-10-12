"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { confirmOrder, cancelOrder, advanceOrder } from "@/lib/actions/orders";
import { NEXT_ORDER_STATUS, ORDER_STATUS_LABELS } from "@/lib/constants";
import type { OrderStatus } from "@/lib/generated/prisma/client";

export function OrderActions({
  id,
  status,
  compact = false,
}: {
  id: string;
  status: OrderStatus;
  /** Мелкие кнопки для карточек на дашборде */
  compact?: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);

  const run = async (fn: () => Promise<{ ok: boolean; error?: string }>) => {
    setPending(true);
    const result = await fn();
    setPending(false);
    if (!result.ok) {
      toast.error(result.error ?? "Не удалось выполнить действие");
      return;
    }
    toast.success("Статус обновлён");
    router.refresh();
  };

  const next = NEXT_ORDER_STATUS[status];
  const isTerminal = status === "COMPLETED" || status === "CANCELLED";
  const size = compact ? "sm" : "default";

  return (
    <div className="flex flex-wrap gap-2">
      {status === "PENDING_CONFIRMATION" && (
        <Button size={size} disabled={pending} onClick={() => run(() => confirmOrder(id))}>
          Подтвердить
        </Button>
      )}
      {!isTerminal && status !== "PENDING_CONFIRMATION" && next && (
        <Button size={size} disabled={pending} onClick={() => run(() => advanceOrder(id))}>
          → {ORDER_STATUS_LABELS[next]}
        </Button>
      )}
      {!isTerminal && (
        <Button
          size={size}
          variant={compact ? "ghost" : "destructive"}
          className={compact ? "text-destructive" : undefined}
          disabled={pending}
          onClick={() => {
            if (window.confirm("Отменить заказ?")) run(() => cancelOrder(id));
          }}
        >
          Отменить
        </Button>
      )}
    </div>
  );
}
