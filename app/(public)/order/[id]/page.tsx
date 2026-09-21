import type { Metadata } from "next";
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

export const metadata: Metadata = {
  title: "Статус заказа",
  robots: { index: false, follow: false },
};

async function getOrder(token: string) {
  return prisma.order.findUnique({
    where: { publicToken: token },
    include: { items: true, events: { orderBy: { createdAt: "asc" } } },
  });
}

export default async function OrderStatusPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const order = await getOrder(id);
  if (!order) notFound();

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="font-display text-3xl font-bold">
        Заказ №{order.id.slice(-8).toUpperCase()}
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Создан {formatDateTime(order.createdAt)}
      </p>

      <div className="mt-4">
        <Badge className={ORDER_STATUS_COLORS[order.status]} variant="outline">
          {ORDER_STATUS_LABELS[order.status]}
        </Badge>
      </div>

      {order.status === "PENDING_CONFIRMATION" && (
        <p className="mt-4 rounded-md bg-secondary p-4 text-sm">
          Ваш заказ ожидает подтверждения оператором. В ближайшее время вам позвонят
          по указанному номеру телефона.
        </p>
      )}

      <div className="mt-8 grid gap-8 md:grid-cols-2">
        <div>
          <h2 className="font-display font-semibold">Состав заказа</h2>
          <div className="mt-3 space-y-2 text-sm">
            {order.items.map((item) => (
              <div key={item.id} className="flex justify-between">
                <span>
                  {item.nameSnapshot} × {item.qty}
                </span>
                <span>{formatMoney(item.lineTotal)}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 space-y-1 border-t border-border pt-3 text-sm">
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
            {Number(order.deliveryFee) > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Доставка</span>
                <span>{formatMoney(order.deliveryFee)}</span>
              </div>
            )}
            <div className="flex justify-between text-base font-semibold">
              <span>Итого</span>
              <span>{formatMoney(order.total)}</span>
            </div>
          </div>
        </div>

        <div>
          <h2 className="font-display font-semibold">Детали</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <Row label="Способ получения" value={FULFILLMENT_LABELS[order.fulfillment]} />
            {order.address && <Row label="Адрес" value={order.address} />}
            <Row label="Оплата" value={PAYMENT_METHOD_LABELS[order.paymentMethod]} />
            <Row label="Телефон" value={order.phone} />
          </dl>

          <h2 className="mt-6 font-display font-semibold">История</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {order.events.map((event) => (
              <li key={event.id} className="flex justify-between text-muted-foreground">
                <span>{ORDER_STATUS_LABELS[event.toStatus]}</span>
                <span>{formatDateTime(event.createdAt)}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-muted-foreground">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
