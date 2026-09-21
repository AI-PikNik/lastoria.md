import { prisma } from "@/lib/prisma";
import { getEmailProvider } from "@/lib/email";
import {
  FULFILLMENT_LABELS,
  ORDER_STATUS_LABELS,
} from "@/lib/constants";
import { formatMoney } from "@/lib/format";
import type {
  Order,
  OrderItem,
  OrderStatus,
  Prisma,
} from "@/lib/generated/prisma/client";

type OrderForNotification = Order & { items: OrderItem[] };

function orderItemsList(items: OrderItem[]): string {
  return items
    .map((item) => `• ${item.nameSnapshot} × ${item.qty} — ${formatMoney(item.lineTotal)}`)
    .join("\n");
}

async function logNotification(
  channel: "TELEGRAM" | "EMAIL",
  type: "NEW_ORDER" | "STATUS_CHANGED",
  payload: Record<string, unknown>,
  status: "SENT" | "FAILED",
  error?: string
) {
  await prisma.notificationLog.create({
    data: {
      channel,
      type,
      payload: payload as unknown as Prisma.InputJsonValue,
      status,
      error: error ?? null,
    },
  });
}

async function sendTelegramMessage(text: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_ADMIN_CHAT_ID;

  if (!token || !chatId) {
    throw new Error("not configured: TELEGRAM_BOT_TOKEN / TELEGRAM_ADMIN_CHAT_ID missing");
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

function buildOrderTelegramText(
  order: OrderForNotification,
  headline: string
): string {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const lines = [
    `<b>${headline}</b>`,
    `Заказ №${order.id.slice(-8).toUpperCase()}`,
    `Статус: ${ORDER_STATUS_LABELS[order.status]}`,
    `Клиент: ${order.customerName}`,
    `Телефон: ${order.phone}`,
    `Получение: ${FULFILLMENT_LABELS[order.fulfillment]}`,
  ];
  if (order.address) lines.push(`Адрес: ${order.address}`);
  lines.push("", orderItemsList(order.items), "", `Итого: ${formatMoney(order.total)}`);
  lines.push("", `${siteUrl}/admin/orders/${order.id}`);
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
    await logNotification(
      "TELEGRAM",
      type,
      { orderId: order.id, text },
      "FAILED",
      message
    );
  }
}

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
    await logNotification(
      "EMAIL",
      type,
      { orderId, to, subject },
      "FAILED",
      message
    );
  }
}

function orderEmailBody(order: OrderForNotification, intro: string): { html: string; text: string } {
  const itemsText = order.items
    .map((item) => `${item.nameSnapshot} × ${item.qty} — ${formatMoney(item.lineTotal)}`)
    .join("\n");
  const itemsHtml = order.items
    .map(
      (item) =>
        `<tr><td>${item.nameSnapshot}</td><td>× ${item.qty}</td><td>${formatMoney(item.lineTotal)}</td></tr>`
    )
    .join("");

  const text = [
    intro,
    `Заказ №${order.id.slice(-8).toUpperCase()}`,
    `Статус: ${ORDER_STATUS_LABELS[order.status]}`,
    "",
    itemsText,
    "",
    `Итого: ${formatMoney(order.total)}`,
  ].join("\n");

  const html = `
    <div style="font-family: sans-serif; color: #2a1e16;">
      <h2>${intro}</h2>
      <p>Заказ №${order.id.slice(-8).toUpperCase()}</p>
      <p>Статус: <strong>${ORDER_STATUS_LABELS[order.status]}</strong></p>
      <table style="width:100%; border-collapse: collapse;">${itemsHtml}</table>
      <p style="margin-top:16px;"><strong>Итого: ${formatMoney(order.total)}</strong></p>
    </div>
  `;

  return { html, text };
}

export async function notifyNewOrder(order: OrderForNotification): Promise<void> {
  await trySendTelegram(order, "NEW_ORDER", "Новый заказ, ожидает подтверждения");

  const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL;
  if (adminEmail) {
    const { html, text } = orderEmailBody(order, "Новый заказ на сайте");
    await trySendEmail(
      adminEmail,
      `Новый заказ №${order.id.slice(-8).toUpperCase()}`,
      html,
      text,
      "NEW_ORDER",
      order.id
    );
  }

  if (order.email) {
    const { html, text } = orderEmailBody(
      order,
      "Спасибо! Ваш заказ принят и ожидает подтверждения оператором"
    );
    await trySendEmail(
      order.email,
      `Ваш заказ №${order.id.slice(-8).toUpperCase()} принят`,
      html,
      text,
      "NEW_ORDER",
      order.id
    );
  }
}

const NOTIFIABLE_STATUS_CHANGES: OrderStatus[] = [
  "CONFIRMED",
  "CANCELLED",
  "COMPLETED",
];

export async function notifyOrderStatusChange(
  order: OrderForNotification
): Promise<void> {
  if (!NOTIFIABLE_STATUS_CHANGES.includes(order.status)) return;

  await trySendTelegram(order, "STATUS_CHANGED", "Статус заказа изменён");

  if (order.email) {
    const { html, text } = orderEmailBody(
      order,
      `Статус вашего заказа изменён: ${ORDER_STATUS_LABELS[order.status]}`
    );
    await trySendEmail(
      order.email,
      `Заказ №${order.id.slice(-8).toUpperCase()}: ${ORDER_STATUS_LABELS[order.status]}`,
      html,
      text,
      "STATUS_CHANGED",
      order.id
    );
  }
}
