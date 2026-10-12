"use client";

import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { TableRow } from "@/components/ui/table";

/** Строка таблицы, которая целиком открывает заказ по клику */
export function OrderRowLink({ href, children }: { href: string; children: ReactNode }) {
  const router = useRouter();
  return (
    <TableRow
      className="cursor-pointer hover:bg-muted/60"
      onClick={(event) => {
        // не перехватываем клики по ссылкам/кнопкам внутри строки и выделение текста
        if ((event.target as HTMLElement).closest("a,button") || window.getSelection()?.toString()) return;
        if (event.metaKey || event.ctrlKey) window.open(href, "_blank");
        else router.push(href);
      }}
    >
      {children}
    </TableRow>
  );
}
