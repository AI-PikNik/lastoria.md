import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatMoney, formatDateTime } from "@/lib/format";
import {
  FULFILLMENT_LABELS,
  ORDER_STATUS_COLORS,
  ORDER_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
} from "@/lib/constants";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { OrderActions } from "@/components/admin/order-actions";

export default async function AdminOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const order = await prisma.order.findUnique({
    where: { id },
    include: { items: true, events: { orderBy: { createdAt: "asc" } } },
  });
  if (!order) notFound();

  const appliedPromos = Array.isArray(order.appliedPromos)
    ? (order.appliedPromos as unknown as { id: string; name: string; discountAmount: number }[])
    : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">
            Заказ №{order.id.slice(-8).toUpperCase()}
          </h1>
          <p className="text-sm text-muted-foreground">{formatDateTime(order.createdAt)}</p>
        </div>
        <Badge variant="outline" className={ORDER_STATUS_COLORS[order.status]}>
          {ORDER_STATUS_LABELS[order.status]}
        </Badge>
      </div>

      <OrderActions id={order.id} status={order.status} />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Позиции</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {order.items.map((item) => (
              <div key={item.id} className="flex justify-between">
                <span>
                  {item.nameSnapshot} × {item.qty}
                  {item.variantSnapshot && (
                    <span className="text-muted-foreground">
                      {" "}
                      ({(item.variantSnapshot as unknown as { name: string }).name})
                    </span>
                  )}
                </span>
                <span>{formatMoney(item.lineTotal)}</span>
              </div>
            ))}
            <div className="space-y-1 border-t border-border pt-3">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Товары</span>
                <span>{formatMoney(order.subtotal)}</span>
              </div>
              {Number(order.discountTotal) > 0 && (
                <div className="flex justify-between text-primary">
                  <span>Скидка</span>
                  <span>−{formatMoney(order.discountTotal)}</span>
                </div>
              )}
              {appliedPromos.map((p) => (
                <p key={p.id} className="text-xs text-muted-foreground">
                  Промо «{p.name}»: −{formatMoney(p.discountAmount)}
                </p>
              ))}
              {Number(order.deliveryFee) > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Доставка</span>
                  <span>{formatMoney(order.deliveryFee)}</span>
                </div>
              )}
              <div className="flex justify-between font-semibold">
                <span>Итого</span>
                <span>{formatMoney(order.total)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Клиент и доставка</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="Имя" value={order.customerName} />
            <Row label="Телефон" value={order.phone} />
            {order.email && <Row label="Email" value={order.email} />}
            <Row label="Способ получения" value={FULFILLMENT_LABELS[order.fulfillment]} />
            {order.address && <Row label="Адрес" value={order.address} />}
            <Row label="Оплата" value={PAYMENT_METHOD_LABELS[order.paymentMethod]} />
            {order.comment && <Row label="Комментарий" value={order.comment} />}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Таймлайн</CardTitle></CardHeader>
        <CardContent>
          <ol className="space-y-3 border-l border-border pl-4">
            {order.events.map((event) => (
              <li key={event.id} className="relative text-sm">
                <span className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full bg-primary" />
                <p className="font-medium">{ORDER_STATUS_LABELS[event.toStatus]}</p>
                <p className="text-xs text-muted-foreground">
                  {formatDateTime(event.createdAt)} · {actorLabel(event.actor)}
                  {event.note && ` · ${event.note}`}
                </p>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span>{value}</span>
    </div>
  );
}

function actorLabel(actor: string) {
  if (actor === "CUSTOMER") return "Клиент";
  if (actor === "ADMIN") return "Оператор";
  return "Система";
}
