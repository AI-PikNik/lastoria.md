"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { getOrdersStamp } from "@/lib/actions/orders";

const INTERVAL_MS = 15_000;

/** Короткий звуковой сигнал о новом заказе (без файлов) */
function beep() {
  try {
    const AudioCtx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.6);
  } catch {
    // браузер запретил звук до первого клика — не страшно
  }
}

/**
 * Автообновление дашборда и списка заказов: каждые 15 секунд проверяет,
 * не появилось ли новых/изменённых заказов, и обновляет страницу.
 * О новом заказе сообщает всплывающим уведомлением и звуком.
 */
export function LiveOrders({ initialStamp, initialPending }: { initialStamp: string; initialPending: number }) {
  const router = useRouter();
  const stampRef = React.useRef(initialStamp);
  const pendingRef = React.useRef(initialPending);
  const [lastCheck, setLastCheck] = React.useState<string>("");

  React.useEffect(() => {
    stampRef.current = initialStamp;
    pendingRef.current = initialPending;
  }, [initialStamp, initialPending]);

  React.useEffect(() => {
    let stopped = false;
    const tick = async () => {
      if (document.visibilityState === "hidden") return;
      try {
        const { stamp, pending } = await getOrdersStamp();
        if (stopped) return;
        setLastCheck(new Date().toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
        if (stamp !== stampRef.current) {
          if (pending > pendingRef.current) {
            toast.info("Новый заказ ожидает подтверждения", { duration: 10_000 });
            beep();
          }
          stampRef.current = stamp;
          pendingRef.current = pending;
          router.refresh();
        }
      } catch {
        // сеть пропала — попробуем в следующий раз
      }
    };
    const timer = window.setInterval(tick, INTERVAL_MS);
    document.addEventListener("visibilitychange", tick);
    return () => {
      stopped = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [router]);

  return (
    <p className="flex items-center gap-2 text-xs text-muted-foreground" aria-live="polite">
      <span className="relative flex size-2">
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-60" />
        <span className="relative inline-flex size-2 rounded-full bg-success" />
      </span>
      Автообновление каждые 15 с{lastCheck ? ` · проверено в ${lastCheck}` : ""}
    </p>
  );
}
