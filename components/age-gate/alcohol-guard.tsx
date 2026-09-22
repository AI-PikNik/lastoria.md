"use client";

import * as React from "react";
import { useRouter } from "@/i18n/navigation";
import { useAgeGate } from "./age-gate-context";

/**
 * Страница алкогольного товара: при первом заходе показываем окно 18+.
 * Отказ — возврат в меню. Контент рендерится всегда (поисковики его видят),
 * но добавить товар в корзину без подтверждения нельзя (и сервер это проверяет).
 */
export function AlcoholGuard({ children }: { children: React.ReactNode }) {
  const { confirmed, ready, requestConfirmation } = useAgeGate();
  const router = useRouter();
  const asked = React.useRef(false);

  React.useEffect(() => {
    if (!ready || confirmed || asked.current) return;
    asked.current = true;
    requestConfirmation().then((ok) => {
      if (!ok) router.replace("/menu");
    });
  }, [ready, confirmed, requestConfirmation, router]);

  return <>{children}</>;
}
