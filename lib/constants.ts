import type {
  CategoryKind,
  FulfillmentType,
  OrderStatus,
  PaymentMethod,
} from "@/lib/generated/prisma/client";

export const CURRENCY = "MDL";

/** Тип группы товаров (для промо «по типу» и аналитики). Подписи — для админки. */
export const CATEGORY_KIND_LABELS: Record<CategoryKind, string> = {
  PIZZA: "Пицца",
  DRINK: "Напитки",
  ALCOHOL: "Алкоголь (18+)",
  OTHER: "Прочее",
  CUSTOM: "Своя группа",
};

export const FULFILLMENT_LABELS: Record<FulfillmentType, string> = {
  DELIVERY: "Доставка",
  PICKUP: "Самовывоз",
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH: "Наличными",
  CARD_ON_DELIVERY: "Картой курьеру",
};

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING_CONFIRMATION: "Ожидает подтверждения",
  CONFIRMED: "Подтверждён",
  PREPARING: "Готовится",
  OUT_FOR_DELIVERY: "В пути",
  READY_FOR_PICKUP: "Готов к выдаче",
  COMPLETED: "Завершён",
  CANCELLED: "Отменён",
};

export const ORDER_STATUS_COLORS: Record<OrderStatus, string> = {
  PENDING_CONFIRMATION: "bg-amber-100 text-amber-800 border-amber-300",
  CONFIRMED: "bg-blue-100 text-blue-800 border-blue-300",
  PREPARING: "bg-purple-100 text-purple-800 border-purple-300",
  OUT_FOR_DELIVERY: "bg-indigo-100 text-indigo-800 border-indigo-300",
  READY_FOR_PICKUP: "bg-teal-100 text-teal-800 border-teal-300",
  COMPLETED: "bg-green-100 text-green-800 border-green-300",
  CANCELLED: "bg-red-100 text-red-800 border-red-300",
};

/** Следующий рабочий статус в жизненном цикле заказа. null — конечный статус. */
export const NEXT_ORDER_STATUS: Record<OrderStatus, OrderStatus | null> = {
  PENDING_CONFIRMATION: "CONFIRMED",
  CONFIRMED: "PREPARING",
  PREPARING: "READY_FOR_PICKUP",
  READY_FOR_PICKUP: "OUT_FOR_DELIVERY",
  OUT_FOR_DELIVERY: "COMPLETED",
  COMPLETED: null,
  CANCELLED: null,
};

export const CONFIRMED_STATUSES: OrderStatus[] = [
  "CONFIRMED",
  "PREPARING",
  "OUT_FOR_DELIVERY",
  "READY_FOR_PICKUP",
  "COMPLETED",
];

export const REVENUE_STATUSES: OrderStatus[] = CONFIRMED_STATUSES;

export const MAX_UPLOAD_SIZE_BYTES = 5 * 1024 * 1024;
export const ALLOWED_UPLOAD_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
];
/** Для логотипа и favicon дополнительно разрешены SVG и ICO */
export const ALLOWED_BRAND_MIME_TYPES = [
  ...ALLOWED_UPLOAD_MIME_TYPES,
  "image/svg+xml",
  "image/x-icon",
  "image/vnd.microsoft.icon",
];
