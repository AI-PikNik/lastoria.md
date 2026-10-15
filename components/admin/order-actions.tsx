"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowRight, CheckCircle2, Loader2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { confirmOrder, cancelOrder, advanceOrder } from "@/lib/actions/orders";
import { NEXT_ORDER_STATUS, ORDER_STATUS_LABELS } from "@/lib/constants";
import type { OrderStatus } from "@/lib/generated/prisma/client";

/**
 * Кнопки смены статуса. Подтвердить — зелёная, следующий статус — винная,
 * отменить — с красной рамкой; у каждой иконка, чтобы не перепутать.
 */
export function OrderActions({
  id,
  status,
  compact = false,
}: {
  id: string;
  status: OrderStatus;
  /** Вариант для карточек на дашборде */
  compact?: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = React.useState<string | null>(null);

  const run = async (key: string, fn: () => Promise<{ ok: boolean; error?: string }>, success: string) => {
    setPending(key);
    const result = await fn();
    setPending(null);
    if (!result.ok) {
      toast.error(result.error ?? "Не удалось выполнить действие");
      return;
    }
    toast.success(success);
    router.refresh();
  };

  const next = NEXT_ORDER_STATUS[status];
  const isTerminal = status === "COMPLETED" || status === "CANCELLED";
  const size = compact ? "default" : "lg";
  const spin = <Loader2 className="animate-spin" aria-hidden="true" />;

  if (isTerminal) return null;

  return (
    <div className="flex flex-wrap gap-2" onClick={(e) => e.stopPropagation()}>
      {status === "PENDING_CONFIRMATION" ? (
        <Button
          size={size}
          variant="success"
          disabled={pending !== null}
          onClick={() => run("confirm", () => confirmOrder(id), "Заказ подтверждён")}
        >
          {pending === "confirm" ? spin : <CheckCircle2 aria-hidden="true" />}
          Подтвердить заказ
        </Button>
      ) : (
        next && (
          <Button
            size={size}
            disabled={pending !== null}
            onClick={() => run("advance", () => advanceOrder(id), `Статус: ${ORDER_STATUS_LABELS[next]}`)}
          >
            {pending === "advance" ? spin : <ArrowRight aria-hidden="true" />}
            {ORDER_STATUS_LABELS[next]}
          </Button>
        )
      )}
      <Button
        size={size}
        variant="danger"
        disabled={pending !== null}
        onClick={() => {
          if (window.confirm("Отменить заказ? Клиент получит уведомление, если указал email.")) {
            run("cancel", () => cancelOrder(id), "Заказ отменён");
          }
        }}
      >
        {pending === "cancel" ? spin : <XCircle aria-hidden="true" />}
        Отменить
      </Button>
    </div>
  );
}
