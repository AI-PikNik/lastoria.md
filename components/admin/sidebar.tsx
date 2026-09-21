"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Pizza,
  Tags,
  Percent,
  ClipboardList,
  BarChart3,
  Users,
  Settings,
  Image as ImageIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/admin", label: "Дашборд", icon: LayoutDashboard, exact: true },
  { href: "/admin/orders", label: "Заказы", icon: ClipboardList },
  { href: "/admin/products", label: "Товары", icon: Pizza },
  { href: "/admin/categories", label: "Категории", icon: Tags },
  { href: "/admin/promos", label: "Промо и скидки", icon: Percent },
  { href: "/admin/analytics", label: "Аналитика", icon: BarChart3 },
  { href: "/admin/customers", label: "Клиенты", icon: Users },
  { href: "/admin/media", label: "Медиатека", icon: ImageIcon },
  { href: "/admin/settings", label: "Настройки", icon: Settings },
];

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <nav className="flex h-full w-60 shrink-0 flex-col gap-1 border-r border-border bg-card p-4">
      <Link href="/admin" className="mb-4 px-2 font-display text-lg font-semibold text-primary">
        La Storia
      </Link>
      {NAV.map((item) => {
        const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium",
              active
                ? "bg-primary text-primary-foreground"
                : "text-foreground/80 hover:bg-secondary"
            )}
          >
            <Icon className="h-4 w-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
