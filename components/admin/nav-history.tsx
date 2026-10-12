"use client";

import * as React from "react";
import { usePathname, useSearchParams } from "next/navigation";

const KEY = "lastoria:admin-history";

function read(): string[] {
  try {
    return JSON.parse(window.sessionStorage.getItem(KEY) ?? "[]");
  } catch {
    return [];
  }
}

function write(stack: string[]) {
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(stack.slice(-30)));
  } catch {
    // ignore
  }
}

/** Запоминает путь по страницам админки (с фильтрами), чтобы «Назад» возвращал туда же */
export function NavHistoryTracker() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  React.useEffect(() => {
    const url = search ? `${pathname}?${search}` : pathname;
    const stack = read();
    const top = stack[stack.length - 1];
    if (top === url) return;
    // смена фильтров на той же странице — заменяем, а не добавляем
    if (top && top.split("?")[0] === pathname) stack[stack.length - 1] = url;
    else stack.push(url);
    write(stack);
  }, [pathname, search]);
  return null;
}

/** Предыдущая страница админки (или null) — и убирает текущую из истории */
export function popPreviousAdminUrl(): string | null {
  const stack = read();
  if (stack.length < 2) return null;
  stack.pop();
  write(stack);
  return stack[stack.length - 1] ?? null;
}
