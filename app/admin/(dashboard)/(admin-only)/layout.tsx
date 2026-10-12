import type { ReactNode } from "react";
import { requireAdmin } from "@/lib/auth-guard";

/** Разделы только для администратора. Оператора перенаправляем к заказам. */
export default async function AdminOnlyLayout({ children }: { children: ReactNode }) {
  await requireAdmin();
  return <>{children}</>;
}
