import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatDateTime, formatMoney } from "@/lib/format";
import { ORDER_STATUS_COLORS, ORDER_STATUS_LABELS, REVENUE_STATUSES } from "@/lib/constants";
import { Badge } from "@/components/ui/badge";
import { BackButton } from "@/components/admin/back-button";
import { CustomerForm } from "@/components/admin/customer-form";

export const metadata = { title: "Клиент" };

export default async function AdminCustomerPage({ params }: PageProps<"/admin/customers/[phone]">) {
  const phone = decodeURIComponent((await params).phone);
  const orders = await prisma.order.findMany({ where: { phone }, orderBy: { createdAt: "desc" } });
  if (orders.length === 0) notFound();

  const latest = orders[0];
  const spent = orders.filter((o) => REVENUE_STATUSES.includes(o.status)).reduce((s, o) => s + Number(o.total), 0);
  const active = orders.filter((o) => o.status !== "COMPLETED" && o.status !== "CANCELLED").length;

  return (
    <div className="space-y-6">
      <BackButton fallback="/admin/customers" label="Назад" />
      <div>
        <h1 className="font-display text-2xl font-bold">{latest.customerName}</h1>
        <p className="text-sm text-muted-foreground">
          {phone} · заказов: {orders.length} · покупок на {formatMoney(spent, "admin")}
        </p>
      </div>

      <CustomerForm
        phone={phone}
        initial={{ customerName: latest.customerName, phone, email: latest.email ?? "" }}
        activeOrders={active}
      />

      <section className="rounded-xl border border-border bg-card">
        <h2 className="border-b border-border px-4 py-3 font-semibold">Заказы клиента</h2>
        <ul className="divide-y divide-border">
          {orders.map((order) => (
            <li key={order.id}>
              <Link href={`/admin/orders/${order.id}`} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 hover:bg-muted/60">
                <span>
                  <span className="font-medium">№{order.id.slice(-8).toUpperCase()}</span>
                  <span className="ml-2 text-sm text-muted-foreground">{formatDateTime(order.createdAt)}</span>
                </span>
                <span className="flex items-center gap-3">
                  <span className="font-semibold">{formatMoney(order.total, "admin")}</span>
                  <Badge variant="outline" className={ORDER_STATUS_COLORS[order.status]}>
                    {ORDER_STATUS_LABELS[order.status]}
                  </Badge>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
