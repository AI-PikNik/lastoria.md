import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { CheckCircle2, Clock, XCircle } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { resolveLocaleParam } from "@/lib/i18n/server";
import { formatDateTime, formatMoney } from "@/lib/format";
import { orderNumber } from "@/lib/notifications";
import { SectionTitle } from "@/theme/decor";
import { cn } from "@/lib/utils";

// Статус заказа меняется в любой момент — страница всегда свежая
export const dynamic = "force-dynamic";

type Props = PageProps<"/[locale]/order/[id]">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = await resolveLocaleParam(params);
  const t = await getTranslations({ locale, namespace: "order" });
  return { title: t("pageTitle"), robots: { index: false, follow: false } };
}

export default async function OrderStatusPage({ params }: Props) {
  const locale = await resolveLocaleParam(params);
  const { id } = await params;
  const order = await prisma.order.findUnique({
    where: { publicToken: id },
    include: { items: true, events: { orderBy: { createdAt: "asc" } } },
  });
  if (!order) notFound();

  const [t, tCheckout] = await Promise.all([
    getTranslations({ locale, namespace: "order" }),
    getTranslations({ locale, namespace: "checkout" }),
  ]);
  const money = (v: unknown) => formatMoney(v, locale);
  const cancelled = order.status === "CANCELLED";
  const done = order.status === "COMPLETED";
  const StatusIcon = cancelled ? XCircle : done ? CheckCircle2 : Clock;

  return (
    <div className="mx-auto max-w-4xl px-4 pt-6">
      <SectionTitle as="h1" title={t("title", { number: orderNumber(order) })} subtitle={t("created", { date: formatDateTime(order.createdAt, locale) })} />

      <div
        role="status"
        className={cn(
          "mx-auto mt-6 flex max-w-xl items-center gap-3 rounded-xl border p-4",
          cancelled ? "border-destructive/40 bg-destructive/10" : "border-olive/40 bg-olive/10"
        )}
      >
        <StatusIcon className={cn("size-7 shrink-0", cancelled ? "text-destructive" : "text-olive")} aria-hidden="true" />
        <div>
          <p className="font-display text-lg font-bold">{t(`status.${order.status}`)}</p>
          {order.status === "PENDING_CONFIRMATION" && <p className="text-sm text-foreground/80">{t("pendingNote")}</p>}
        </div>
      </div>

      <div className="mt-8 grid gap-6 md:grid-cols-2">
        <section className="rounded-xl bg-card p-5 shadow-card gold-frame">
          <h2 className="font-display text-lg font-bold text-primary">{t("items")}</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {order.items.map((item) => {
              const variant = item.variantSnapshot as { name?: string } | null;
              return (
                <li key={item.id} className="flex justify-between gap-3">
                  <span>
                    {item.nameSnapshot}
                    {variant?.name ? ` (${variant.name})` : ""} × {item.qty}
                  </span>
                  <span className="shrink-0">{money(item.lineTotal)}</span>
                </li>
              );
            })}
          </ul>
          <dl className="mt-4 space-y-1 border-t border-border pt-3 text-sm">
            <Row label={t("subtotal")} value={money(order.subtotal)} />
            {Number(order.discountTotal) > 0 && <Row label={t("discount")} value={`−${money(order.discountTotal)}`} />}
            {order.fulfillment === "DELIVERY" && <Row label={t("delivery")} value={money(order.deliveryFee)} />}
            <div className="flex justify-between pt-1 font-display text-lg font-bold">
              <dt>{t("total")}</dt>
              <dd className="text-primary">{money(order.total)}</dd>
            </div>
          </dl>
        </section>

        <section className="rounded-xl bg-card p-5 shadow-card gold-frame">
          <h2 className="font-display text-lg font-bold text-primary">{t("details")}</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <Row
              label={t("fulfillment")}
              value={order.fulfillment === "DELIVERY" ? tCheckout("delivery") : tCheckout("pickup")}
            />
            {order.deliveryZoneName && (
              <Row label={t("zone")} value={[order.deliveryCityName, order.deliveryZoneName].filter(Boolean).join(", ")} />
            )}
            {order.address && <Row label={t("address")} value={order.address} />}
            <Row
              label={t("payment")}
              value={order.paymentMethod === "CASH" ? tCheckout("cash") : tCheckout("cardOnDelivery")}
            />
            <Row label={t("phone")} value={order.phone} />
          </dl>

          <h2 className="mt-6 font-display text-lg font-bold text-primary">{t("history")}</h2>
          <ol className="mt-3 space-y-2 text-sm">
            {order.events.map((event) => (
              <li key={event.id} className="flex justify-between gap-3 text-muted-foreground">
                <span>{t(`status.${event.toStatus}`)}</span>
                <time dateTime={event.createdAt.toISOString()}>{formatDateTime(event.createdAt, locale)}</time>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right">{value}</dd>
    </div>
  );
}
