"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  ClipboardList,
  ExternalLink,
  Image as ImageIcon,
  Languages,
  LayoutDashboard,
  Percent,
  Pizza,
  Settings,
  Tags,
  Truck,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/admin", label: "Дашборд", icon: LayoutDashboard, exact: true },
  { href: "/admin/orders", label: "Заказы", icon: ClipboardList },
  { href: "/admin/products", label: "Товары", icon: Pizza },
  { href: "/admin/categories", label: "Группы товаров", icon: Tags },
  { href: "/admin/promos", label: "Промо и скидки", icon: Percent },
  { href: "/admin/delivery", label: "Доставка", icon: Truck },
  { href: "/admin/translations", label: "Переводы", icon: Languages },
  { href: "/admin/analytics", label: "Аналитика", icon: BarChart3 },
  { href: "/admin/customers", label: "Клиенты", icon: Users },
  { href: "/admin/media", label: "Медиатека", icon: ImageIcon },
  { href: "/admin/settings", label: "Настройки", icon: Settings },
];

function useActive() {
  const pathname = usePathname();
  return (href: string, exact?: boolean) => (exact ? pathname === href : pathname.startsWith(href));
}

export function AdminSidebar() {
  const isActive = useActive();
  return (
    <nav className="sticky top-0 hidden h-screen w-56 shrink-0 flex-col gap-0.5 overflow-y-auto border-r border-border bg-card p-3 lg:flex">
      <Link href="/admin" className="mb-3 px-2 font-display text-xl font-bold italic text-primary">
        La Storia
        <span className="block font-sans text-xs font-normal not-italic text-muted-foreground">админ-панель</span>
      </Link>
      {NAV.map((item) => {
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium",
              isActive(item.href, item.exact) ? "bg-primary text-primary-foreground" : "text-foreground/80 hover:bg-secondary"
            )}
          >
            <Icon className="size-4" />
            {item.label}
          </Link>
        );
      })}
      <a
        href="/"
        target="_blank"
        className="mt-auto flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-secondary"
      >
        <ExternalLink className="size-4" /> Открыть сайт
      </a>
    </nav>
  );
}

/** Навигация админки на телефоне/планшете — горизонтальная лента */
export function AdminMobileNav() {
  const isActive = useActive();
  return (
    <nav className="no-scrollbar flex gap-1 overflow-x-auto border-b border-border bg-card px-3 py-2 lg:hidden">
      {NAV.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={cn(
            "whitespace-nowrap rounded-full px-3 py-1.5 text-sm",
            isActive(item.href, item.exact) ? "bg-primary text-primary-foreground" : "bg-secondary"
          )}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
