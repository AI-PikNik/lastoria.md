import { describe, expect, it } from "vitest";
import { orderTotals, recalcOrderLines } from "@/lib/order-edit";
import { adminEnvFingerprint } from "@/lib/admin-env-sync";
import { renderCopyright } from "@/lib/settings-format";
import { ACTIVE_STATUSES } from "@/lib/constants";

describe("редактирование заказа", () => {
  const existing = [
    // 2 × 100 со скидкой 15% → 170
    { id: "a", qty: 2, unitPrice: 100, lineTotal: 170 },
    { id: "b", qty: 1, unitPrice: 50, lineTotal: 50 },
  ];

  it("у старой позиции сохраняется цена и скидка за штуку", () => {
    const [a] = recalcOrderLines(existing, [{ id: "a", qty: 3 }]);
    expect(a).toEqual({ id: "a", qty: 3, unitPrice: 100, lineTotal: 255 });
  });

  it("новая позиция — по цене каталога без скидки; удалённые не попадают в итог", () => {
    const lines = recalcOrderLines(existing, [{ id: "a", qty: 2 }, { qty: 2, unitPrice: 30 }]);
    expect(lines).toHaveLength(2);
    expect(lines[1]).toEqual({ id: null, qty: 2, unitPrice: 30, lineTotal: 60 });
    expect(orderTotals(lines, 40)).toEqual({ subtotal: 260, discountTotal: 30, deliveryFee: 40, total: 270 });
  });

  it("количество не меньше 1, доставка не отрицательная", () => {
    const lines = recalcOrderLines(existing, [{ id: "b", qty: 0 }]);
    expect(lines[0].qty).toBe(1);
    expect(orderTotals(lines, -10).deliveryFee).toBe(0);
  });
});

describe("администратор из .env", () => {
  it("отпечаток меняется при смене пароля и не зависит от регистра email", () => {
    const a = adminEnvFingerprint("Admin@LaStoria.md", "secret-1");
    expect(a).toBe(adminEnvFingerprint("admin@lastoria.md", "secret-1"));
    expect(a).not.toBe(adminEnvFingerprint("admin@lastoria.md", "secret-2"));
    expect(a).not.toContain("secret");
  });
});

describe("подвал и статусы", () => {
  it("копирайт подставляет год и название", () => {
    expect(renderCopyright("© {year} {name}. Drepturi rezervate.", "La Storia", 2027)).toBe("© 2027 La Storia. Drepturi rezervate.");
  });

  it("«подтверждённые (в работе)» не включают завершённые и отменённые", () => {
    expect(ACTIVE_STATUSES).not.toContain("COMPLETED");
    expect(ACTIVE_STATUSES).not.toContain("CANCELLED");
    expect(ACTIVE_STATUSES).toContain("CONFIRMED");
  });
});

describe("«сегодня» по Кишинёву", () => {
  it("23:30 UTC 11 октября — это уже 12 октября в Кишинёве (UTC+3)", async () => {
    const { chisinauToday } = await import("@/lib/analytics-period");
    const { from, to } = chisinauToday(new Date("2026-10-11T23:30:00Z"));
    expect(from.toISOString()).toBe("2026-10-11T21:00:00.000Z");
    expect(to.toISOString()).toBe("2026-10-12T20:59:59.999Z");
  });
});

describe("графики аналитики: разбивка по времени Кишинёва", () => {
  it("сегодня — 24 часовые точки с 00:00 до 23:00", async () => {
    const { buildBuckets, chisinauToday } = await import("@/lib/analytics-period");
    const buckets = buildBuckets(chisinauToday(new Date("2026-10-15T10:00:00Z")), "hour");
    expect(buckets).toHaveLength(24);
    expect(buckets[0]).toEqual({ key: "2026-10-15T00", label: "00:00" });
    expect(buckets[23].label).toBe("23:00");
  });

  it("заказ попадает в час и день по Кишинёву, а не по серверу", async () => {
    const { bucketKey } = await import("@/lib/analytics-period");
    // 22:30 UTC 14 октября = 01:30 15 октября в Кишинёве
    expect(bucketKey(new Date("2026-10-14T22:30:00Z"), "hour")).toBe("2026-10-15T01");
    expect(bucketKey(new Date("2026-10-14T22:30:00Z"), "day")).toBe("2026-10-15");
    // неделя начинается с понедельника (12.10.2026)
    expect(bucketKey(new Date("2026-10-15T10:00:00Z"), "week")).toBe("2026-10-12");
  });

  it("год — 12 месяцев; в день перехода на летнее время 24 часовые точки", async () => {
    const { buildBuckets } = await import("@/lib/analytics-period");
    const year = { from: new Date("2026-01-01T00:00:00+02:00"), to: new Date("2026-12-31T23:59:59+02:00") };
    expect(buildBuckets(year, "month").map((b) => b.label)).toHaveLength(12);
    const dst = { from: new Date("2026-03-29T00:00:00+02:00"), to: new Date("2026-03-29T23:59:59+03:00") };
    expect(buildBuckets(dst, "hour")).toHaveLength(24);
  });

  it("шаг по умолчанию зависит от длины периода", async () => {
    const { defaultGranularity, availableGranularities } = await import("@/lib/analytics-period");
    const day = { from: new Date("2026-10-15T00:00:00Z"), to: new Date("2026-10-15T23:59:59Z") };
    const year = { from: new Date("2026-01-01T00:00:00Z"), to: new Date("2026-12-31T23:59:59Z") };
    expect(defaultGranularity(day)).toBe("hour");
    expect(defaultGranularity(year)).toBe("month");
    expect(availableGranularities(day)).toEqual(["hour", "day"]);
    expect(availableGranularities(year)).toEqual(["day", "week", "month"]);
  });
});

describe("периоды аналитики по календарю Кишинёва", () => {
  it("октябрь 2026: с полуночи 1-го (UTC+3) до конца 31-го (уже UTC+2)", async () => {
    const { chisinauDays } = await import("@/lib/analytics-period");
    const { from, to } = chisinauDays([2026, 9, 1], [2026, 10, 1]);
    expect(from.toISOString()).toBe("2026-09-30T21:00:00.000Z");
    expect(to.toISOString()).toBe("2026-10-31T21:59:59.999Z");
  });

  it("30 дней по дням — ровно 30 точек", async () => {
    const { chisinauDays, buildBuckets } = await import("@/lib/analytics-period");
    expect(buildBuckets(chisinauDays([2026, 8, 17], [2026, 9, 17]), "day")).toHaveLength(30);
  });
});
