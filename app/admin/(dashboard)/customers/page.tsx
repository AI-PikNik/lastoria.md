import { prisma } from "@/lib/prisma";
import { formatMoney, formatDateTime } from "@/lib/format";
import { REVENUE_STATUSES } from "@/lib/constants";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function AdminCustomersPage() {
  const orders = await prisma.order.findMany({
    select: {
      phone: true,
      customerName: true,
      email: true,
      total: true,
      status: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const byPhone = new Map<
    string,
    { name: string; email: string | null; ordersCount: number; totalSpent: number; lastOrderAt: Date }
  >();

  for (const order of orders) {
    const entry = byPhone.get(order.phone) ?? {
      name: order.customerName,
      email: order.email,
      ordersCount: 0,
      totalSpent: 0,
      lastOrderAt: order.createdAt,
    };
    entry.ordersCount += 1;
    if (REVENUE_STATUSES.includes(order.status)) {
      entry.totalSpent += Number(order.total);
    }
    if (order.createdAt > entry.lastOrderAt) entry.lastOrderAt = order.createdAt;
    byPhone.set(order.phone, entry);
  }

  const customers = Array.from(byPhone.entries())
    .map(([phone, data]) => ({ phone, ...data }))
    .sort((a, b) => b.lastOrderAt.getTime() - a.lastOrderAt.getTime());

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-bold">Клиенты</h1>
      <p className="text-sm text-muted-foreground">
        Список формируется автоматически из заказов, отдельная база клиентов не ведётся.
      </p>

      <div className="rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Имя</TableHead>
              <TableHead>Телефон</TableHead>
              <TableHead>Email</TableHead>
              <TableHead className="text-right">Заказов</TableHead>
              <TableHead className="text-right">Сумма покупок</TableHead>
              <TableHead>Последний заказ</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {customers.map((c) => (
              <TableRow key={c.phone}>
                <TableCell className="font-medium">{c.name}</TableCell>
                <TableCell>{c.phone}</TableCell>
                <TableCell className="text-muted-foreground">{c.email ?? "—"}</TableCell>
                <TableCell className="text-right">{c.ordersCount}</TableCell>
                <TableCell className="text-right">{formatMoney(c.totalSpent, "admin")}</TableCell>
                <TableCell>{formatDateTime(c.lastOrderAt)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
