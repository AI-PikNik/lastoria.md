import { describe, expect, it } from "vitest";
import {
  NEXT_ORDER_STATUS,
  CONFIRMED_STATUSES,
  ORDER_STATUS_LABELS,
} from "@/lib/constants";

describe("order status helpers", () => {
  it("описывает полный жизненный цикл заказа от ожидания до завершения", () => {
    const path: string[] = ["PENDING_CONFIRMATION"];
    let current: keyof typeof NEXT_ORDER_STATUS = "PENDING_CONFIRMATION";
    while (NEXT_ORDER_STATUS[current]) {
      current = NEXT_ORDER_STATUS[current]!;
      path.push(current);
    }

    expect(path).toEqual([
      "PENDING_CONFIRMATION",
      "CONFIRMED",
      "PREPARING",
      "READY_FOR_PICKUP",
      "OUT_FOR_DELIVERY",
      "COMPLETED",
    ]);
  });

  it("не имеет следующего статуса для конечных состояний", () => {
    expect(NEXT_ORDER_STATUS.COMPLETED).toBeNull();
    expect(NEXT_ORDER_STATUS.CANCELLED).toBeNull();
  });

  it("относит все рабочие статусы после подтверждения к подтверждённым", () => {
    expect(CONFIRMED_STATUSES).toEqual(
      expect.arrayContaining(["CONFIRMED", "PREPARING", "OUT_FOR_DELIVERY", "READY_FOR_PICKUP", "COMPLETED"])
    );
    expect(CONFIRMED_STATUSES).not.toContain("PENDING_CONFIRMATION");
    expect(CONFIRMED_STATUSES).not.toContain("CANCELLED");
  });

  it("имеет русскую метку для каждого статуса", () => {
    for (const status of Object.keys(NEXT_ORDER_STATUS)) {
      expect(ORDER_STATUS_LABELS[status as keyof typeof ORDER_STATUS_LABELS]).toBeTruthy();
    }
  });
});
