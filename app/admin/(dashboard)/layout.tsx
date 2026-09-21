import type { ReactNode } from "react";
import { requireAdminSession } from "@/lib/auth-guard";
import { AdminSidebar } from "@/components/admin/sidebar";
import { AdminTopbar } from "@/components/admin/topbar";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const session = await requireAdminSession();

  return (
    <div className="flex min-h-screen">
      <AdminSidebar />
      <div className="flex flex-1 flex-col">
        <AdminTopbar email={session.user.email ?? ""} />
        <main className="flex-1 overflow-x-auto p-6">{children}</main>
      </div>
    </div>
  );
}
