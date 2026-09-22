import "server-only";
import { createTranslator } from "next-intl";
import { prisma } from "@/lib/prisma";
import { getEmailProvider } from "@/lib/email";
import { FULFILLMENT_LABELS, ORDER_STATUS_LABELS, PAYMENT_METHOD_LABELS } from "@/lib/constants";
import { formatMoney } from "@/lib/format";
import { getMessagesFor } from "@/lib/i18n/messages";
import { LOCALE_LABELS, isLocale, localizedPath, type AppLocale } from "@/lib/i18n/locales";
import { getSiteUrl } from "@/lib/site-url";
import type { Order, OrderItem, OrderStatus, Prisma } from "@/lib/generated/prisma/client";

type OrderForNotification = Order & { items: OrderItem[] };

export function orderNumber(order: Pick<Order, "id">): string {
  return order.id.slice(-8).toUpperCase();
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function variantLabel(item: OrderItem): string {
  const snap = item.variantSnapshot as { name?: string } | null;
  return snap?.name ? ` (${snap.name})` : "";
}

async function logNotification(
  channel: "TELEGRAM" | "EMAIL",
  type: "NEW_ORDER" | "STATUS_CHANGED",
  payload: Record<string, unknown>,
  status: "SENT" | "FAILED",
  error?: string
) {
  try {
    await prisma.notificationLog.create({
      data: {
        channel,
        type,
        payload: payload as unknown as Prisma.InputJsonValue,
        status,
        error: error ?? null,
      },
    });
  } catch (logError) {
    console.error("[notifications] failed to write log:", logError);
  }
}

/* ─────────────── Telegram (для персонала — на русском) ─────────────── */

async function sendTelegramMessage(text: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const settings = await prisma.settings.findUnique({
    where: { id: "main" },
    select: { telegramChatId: true },
  });
  const chatId = settings?.telegramChatId || process.env.TELEGRAM_ADMIN_CHAT_ID;

  if (!token || !chatId) {
    throw new Error("not configured: TELEGRAM_BOT_TOKEN / chat id missing");
  }

  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Telegram API error ${res.status}: ${body}`);
  }
}

export function buildOrderTelegramText(order: OrderForNotification, headline: string): string {
  const e = escapeHtml;
  const lines = [
    `<b>${e(headline)}</b>`,
    `Заказ №${orderNumber(order)}`,
    `Статус: ${ORDER_STATUS_LABELS[order.status]}`,
    `Клиент: ${e(order.customerName)}`,
    `Телефон: ${e(order.phone)}`,
    `Язык клиента: ${isLocale(order.locale) ? LOCALE_LABELS[order.locale] : order.locale}`,
    `Получение: ${FULFILLMENT_LABELS[order.fulfillment]}`,
    `Оплата: ${PAYMENT_METHOD_LABELS[order.paymentMethod]}`,
  ];
  if (order.deliveryCityName || order.deliveryZoneName) {
    lines.push(`Район: ${e([order.deliveryCityName, order.deliveryZoneName].filter(Boolean).join(", "))}`);
  }
  if (order.address) lines.push(`Адрес: ${e(order.address)}`);
  if (order.ageConfirmed) lines.push("⚠️ В заказе алкоголь — проверить возраст (18+)");
  if (order.comment) lines.push(`Комментарий: ${e(order.comment)}`);
  lines.push(
    "",
    ...order.items.map(
      (item) =>
        `• ${e(item.nameSnapshot)}${e(variantLabel(item))} × ${item.qty} — ${formatMoney(item.lineTotal, "admin")}`
    ),
    ""
  );
  if (Number(order.deliveryFee) > 0) lines.push(`Доставка: ${formatMoney(order.deliveryFee, "admin")}`);
  lines.push(`<b>Итого: ${formatMoney(order.total, "admin")}</b>`, "", `${getSiteUrl()}/admin/orders/${order.id}`);
  return lines.join("\n");
}

async function trySendTelegram(
  order: OrderForNotification,
  type: "NEW_ORDER" | "STATUS_CHANGED",
  headline: string
) {
  const text = buildOrderTelegramText(order, headline);
  try {
    await sendTelegramMessage(text);
    await logNotification("TELEGRAM", type, { orderId: order.id, text }, "SENT");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[notifications] telegram ${type} failed:`, message);
    await logNotification("TELEGRAM", type, { orderId: order.id, text }, "FAILED", message);
  }
}

/* ─────────────── Email ─────────────── */

async function trySendEmail(
  to: string,
  subject: string,
  html: string,
  text: string,
  type: "NEW_ORDER" | "STATUS_CHANGED",
  orderId: string
) {
  try {
    await getEmailProvider().send({ to, subject, html, text });
    await logNotification("EMAIL", type, { orderId, to, subject }, "SENT");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[notifications] email ${type} failed:`, message);
    await logNotification("EMAIL", type, { orderId, to, subject }, "FAILED", message);
  }
}

/** Письмо клиенту — на языке, на котором он оформлял заказ. */
async function customerEmail(order: OrderForNotification, kind: "received" | "status") {
  const locale: AppLocale = isLocale(order.locale) ? order.locale : "ro";
  const messages = await getMessagesFor(locale);
  // Словарь собирается динамически (с правками из админки), поэтому ключи не типизированы
  const t = createTranslator({ locale, messages }) as unknown as (
    key: string,
    values?: Record<string, string | number>
  ) => string;
  const number = orderNumber(order);
  const status = t(`order.status.${order.status}`);
  const trackUrl = `${getSiteUrl()}${localizedPath(locale, `/order/${order.publicToken}`)}`;
  const money = (value: unknown) => formatMoney(value, locale);

  const subject =
    kind === "received"
      ? t("email.receivedSubject", { number })
      : t("email.statusSubject", { number, status });
  const intro = kind === "received" ? t("email.receivedIntro") : t("email.statusIntro", { status });

  const itemsText = order.items.map(
    (item) => `${item.nameSnapshot}${variantLabel(item)} × ${item.qty} — ${money(item.lineTotal)}`
  );
  const text = [
    intro,
    t("email.number", { number }),
    t("email.status", { status }),
    "",
    ...itemsText,
    "",
    t("email.total", { total: money(order.total) }),
    t("email.track", { url: trackUrl }),
  ].join("\n");

  const e = escapeHtml;
  const html = `
<div style="font-family: Georgia, 'Times New Roman', serif; color: #2b2118; background: #f6ebd8; padding: 24px;">
  <div style="max-width: 560px; margin: 0 auto; background: #fff8ee; border: 1px solid #c7a15a; border-radius: 12px; padding: 24px;">
    <p style="margin: 0; font-size: 26px; font-style: italic; font-weight: 700; color: #7a1f1f;">La Storia</p>
    <p style="margin: 2px 0 16px; font-style: italic; color: #6b5646;">Pizzeria tradizionale italiana</p>
    <h1 style="font-size: 18px; margin: 0 0 12px;">${e(intro)}</h1>
    <p style="margin: 0 0 4px;">${e(t("email.number", { number }))}</p>
    <p style="margin: 0 0 16px;"><strong>${e(t("email.status", { status }))}</strong></p>
    <table style="width: 100%; border-collapse: collapse; font-family: Arial, sans-serif; font-size: 14px;">
      ${order.items
        .map(
          (item) =>
            `<tr><td style="padding: 6px 0; border-bottom: 1px solid #e2cfae;">${e(item.nameSnapshot)}${e(variantLabel(item))}</td><td style="padding: 6px 0; border-bottom: 1px solid #e2cfae; text-align: center;">× ${item.qty}</td><td style="padding: 6px 0; border-bottom: 1px solid #e2cfae; text-align: right;">${e(money(item.lineTotal))}</td></tr>`
        )
        .join("")}
    </table>
    <p style="margin: 16px 0; font-size: 16px;"><strong>${e(t("email.total", { total: money(order.total) }))}</strong></p>
    <p style="margin: 0;"><a href="${e(trackUrl)}" style="color: #7a1f1f;">${e(trackUrl)}</a></p>
  </div>
</div>`;

  return { subject, html, text };
}

/** Письмо администратору — на русском. */
function adminEmail(order: OrderForNotification) {
  const text = buildOrderTelegramText(order, "Новый заказ на сайте").replace(/<[^>]+>/g, "");
  const html = `<pre style="font-family: Arial, sans-serif; white-space: pre-wrap;">${buildOrderTelegramText(order, "Новый заказ на сайте")}</pre>`;
  return { subject: `Новый заказ №${orderNumber(order)}`, html, text };
}

export async function notifyNewOrder(order: OrderForNotification): Promise<void> {
  await trySendTelegram(order, "NEW_ORDER", "Новый заказ, ожидает подтверждения");

  const adminTo = process.env.ADMIN_NOTIFICATION_EMAIL;
  if (adminTo) {
    const mail = adminEmail(order);
    await trySendEmail(adminTo, mail.subject, mail.html, mail.text, "NEW_ORDER", order.id);
  }

  if (order.email) {
    const mail = await customerEmail(order, "received");
    await trySendEmail(order.email, mail.subject, mail.html, mail.text, "NEW_ORDER", order.id);
  }
}

const NOTIFIABLE_STATUS_CHANGES: OrderStatus[] = ["CONFIRMED", "CANCELLED", "COMPLETED"];

export async function notifyOrderStatusChange(order: OrderForNotification): Promise<void> {
  if (!NOTIFIABLE_STATUS_CHANGES.includes(order.status)) return;

  await trySendTelegram(order, "STATUS_CHANGED", "Статус заказа изменён");

  if (order.email) {
    const mail = await customerEmail(order, "status");
    await trySendEmail(order.email, mail.subject, mail.html, mail.text, "STATUS_CHANGED", order.id);
  }
}
