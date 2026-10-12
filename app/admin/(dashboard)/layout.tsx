import { Suspense, type ReactNode } from "react";
import { requireStaff } from "@/lib/auth-guard";
import { AdminMobileNav, AdminSidebar } from "@/components/admin/sidebar";
import { AdminTopbar } from "@/components/admin/topbar";
import { NavHistoryTracker } from "@/components/admin/nav-history";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const user = await requireStaff();

  return (
    <div className="flex min-h-screen">
      <Suspense>
        <NavHistoryTracker />
      </Suspense>
      <AdminSidebar role={user.role} />
      <div className="flex min-w-0 flex-1 flex-col">
        <AdminTopbar name={user.name} email={user.email} role={user.role} />
        <AdminMobileNav role={user.role} />
        <main className="flex-1 overflow-x-auto p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
