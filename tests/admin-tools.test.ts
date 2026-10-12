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
