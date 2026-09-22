import { describe, expect, it } from "vitest";
import {
  calculateCartPricing,
  type CartPricingItemInput,
  type CartPricingPromoInput,
} from "@/lib/pricing";

const NOW = new Date("2026-06-15T12:00:00Z");

function item(overrides: Partial<CartPricingItemInput> = {}): CartPricingItemInput {
  return {
    id: "line-1",
    productId: "prod-1",
    categoryId: "cat-pizza",
    kind: "PIZZA",
    unitPrice: 100,
    qty: 1,
    ...overrides,
  };
}

function promo(overrides: Partial<CartPricingPromoInput> = {}): CartPricingPromoInput {
  return {
    id: "promo-1",
    name: "Test promo",
    code: null,
    type: "PERCENT",
    value: 10,
    scope: "PRODUCT",
    targetIds: ["prod-1"],
    minOrderAmount: null,
    startsAt: new Date("2026-01-01T00:00:00Z"),
    endsAt: new Date("2026-12-31T23:59:59Z"),
    isActive: true,
    stackable: false,
    ...overrides,
  };
}

describe("calculateCartPricing", () => {
  it("применяет процентную скидку к одному товару", () => {
    const items = [item({ unitPrice: 100, qty: 2 })];
    const promos = [promo({ type: "PERCENT", value: 20, scope: "PRODUCT", targetIds: ["prod-1"] })];

    const result = calculateCartPricing(items, promos, NOW);

    expect(result.subtotal).toBe(200);
    expect(result.discountTotal).toBe(40);
    expect(result.total).toBe(160);
    expect(result.appliedPromos).toHaveLength(1);
    expect(result.appliedPromos[0].discountAmount).toBe(40);
  });

  it("применяет скидку на категорию ко всем товарам категории", () => {
    const items = [
      item({ id: "a", productId: "pizza-1", categoryId: "cat-pizza", unitPrice: 100, qty: 1 }),
      item({ id: "b", productId: "drink-1", categoryId: "cat-drinks", unitPrice: 50, qty: 1 }),
    ];
    const promos = [
      promo({ scope: "CATEGORY", type: "PERCENT", value: 10, targetIds: ["cat-pizza"] }),
    ];

    const result = calculateCartPricing(items, promos, NOW);

    const pizzaLine = result.items.find((i) => i.productId === "pizza-1")!;
    const drinkLine = result.items.find((i) => i.productId === "drink-1")!;

    expect(pizzaLine.discount).toBe(10);
    expect(drinkLine.discount).toBe(0);
    expect(result.discountTotal).toBe(10);
    expect(result.total).toBe(140);
  });

  it("при конфликте нестакаемых промо применяет только самое выгодное", () => {
    const items = [item({ unitPrice: 200, qty: 1 })];
    const promos = [
      promo({ id: "small", type: "PERCENT", value: 10, stackable: false }),
      promo({ id: "big", type: "PERCENT", value: 30, stackable: false }),
    ];

    const result = calculateCartPricing(items, promos, NOW);

    expect(result.appliedPromos).toHaveLength(1);
    expect(result.appliedPromos[0].id).toBe("big");
    expect(result.discountTotal).toBe(60);
    expect(result.total).toBe(140);
  });

  it("суммирует стекающиеся промо между собой", () => {
    const items = [item({ unitPrice: 100, qty: 1 })];
    const promos = [
      promo({ id: "p1", type: "PERCENT", value: 10, stackable: true }),
      promo({ id: "p2", type: "FIXED", value: 5, scope: "CART", targetIds: [], stackable: true }),
    ];

    const result = calculateCartPricing(items, promos, NOW);

    expect(result.discountTotal).toBe(15);
    expect(result.appliedPromos).toHaveLength(2);
  });

  it("игнорирует просроченное промо", () => {
    const items = [item({ unitPrice: 100, qty: 1 })];
    const promos = [
      promo({
        startsAt: new Date("2025-01-01T00:00:00Z"),
        endsAt: new Date("2025-02-01T00:00:00Z"),
      }),
    ];

    const result = calculateCartPricing(items, promos, NOW);

    expect(result.discountTotal).toBe(0);
    expect(result.total).toBe(100);
    expect(result.appliedPromos).toHaveLength(0);
  });

  it("игнорирует ещё не начавшееся промо", () => {
    const items = [item({ unitPrice: 100, qty: 1 })];
    const promos = [
      promo({
        startsAt: new Date("2027-01-01T00:00:00Z"),
        endsAt: new Date("2027-02-01T00:00:00Z"),
      }),
    ];

    const result = calculateCartPricing(items, promos, NOW);

    expect(result.discountTotal).toBe(0);
  });

  it("игнорирует выключенное промо", () => {
    const items = [item({ unitPrice: 100, qty: 1 })];
    const promos = [promo({ isActive: false })];

    const result = calculateCartPricing(items, promos, NOW);

    expect(result.discountTotal).toBe(0);
  });

  it("не опускает итог корзины ниже нуля", () => {
    const items = [item({ unitPrice: 10, qty: 1 })];
    const promos = [promo({ type: "FIXED", value: 100, scope: "PRODUCT", targetIds: ["prod-1"] })];

    const result = calculateCartPricing(items, promos, NOW);

    expect(result.items[0].lineTotal).toBe(0);
    expect(result.total).toBe(0);
  });

  it("учитывает минимальную сумму заказа", () => {
    const items = [item({ unitPrice: 50, qty: 1 })];
    const promos = [promo({ minOrderAmount: 100 })];

    const result = calculateCartPricing(items, promos, NOW);

    expect(result.discountTotal).toBe(0);
  });

  it("PRODUCT_OVERRIDE выставляет фиксированную цену за единицу", () => {
    const items = [item({ unitPrice: 100, qty: 3 })];
    const promos = [promo({ type: "PRODUCT_OVERRIDE", value: 70 })];

    const result = calculateCartPricing(items, promos, NOW);

    expect(result.items[0].lineTotal).toBe(210);
    expect(result.discountTotal).toBe(90);
  });
});

describe("промо по типу группы и промокоды", () => {
  it("PRODUCT_TYPE-промо применяется к товарам групп нужного типа (kind)", () => {
    const items = [
      item({ id: "a", productId: "wine", categoryId: "cat-alcohol", kind: "ALCOHOL", unitPrice: 200 }),
      item({ id: "b", productId: "pizza", categoryId: "cat-pizza", kind: "PIZZA", unitPrice: 100 }),
    ];
    const result = calculateCartPricing(
      items,
      [promo({ scope: "PRODUCT_TYPE", targetIds: ["ALCOHOL"], value: 10 })],
      NOW
    );
    expect(result.items[0].discount).toBe(20);
    expect(result.items[1].discount).toBe(0);
  });

  it("своя группа (CUSTOM) не попадает под промо на тип PIZZA", () => {
    const result = calculateCartPricing(
      [item({ kind: "CUSTOM", categoryId: "cat-new" })],
      [promo({ scope: "PRODUCT_TYPE", targetIds: ["PIZZA"] })],
      NOW
    );
    expect(result.discountTotal).toBe(0);
  });

  it("публичные названия промо на 4 языках попадают в снимок заказа", () => {
    const result = calculateCartPricing(
      [item()],
      [promo({ publicNames: { ro: "Reducere", ru: "Скидка", en: "Discount", it: "Sconto" } })],
      NOW
    );
    expect(result.appliedPromos[0].publicNames?.ro).toBe("Reducere");
  });
});
