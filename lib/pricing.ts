/** Тип группы товаров (CategoryKind) — по нему работают промо со scope PRODUCT_TYPE */
export type CategoryKindValue = "PIZZA" | "DRINK" | "ALCOHOL" | "OTHER" | "CUSTOM";
export type PromoTypeValue = "PERCENT" | "FIXED" | "PRODUCT_OVERRIDE";
export type PromoScopeValue = "PRODUCT" | "CATEGORY" | "PRODUCT_TYPE" | "CART";

export interface CartPricingItemInput {
  /** Стабильный идентификатор строки корзины (обычно productId, может включать вариант) */
  id: string;
  productId: string;
  categoryId: string;
  kind: CategoryKindValue;
  unitPrice: number;
  qty: number;
}

export interface CartPricingPromoInput {
  id: string;
  name: string;
  publicNames?: Record<string, string>;
  code?: string | null;
  type: PromoTypeValue;
  value: number;
  scope: PromoScopeValue;
  targetIds: string[];
  minOrderAmount?: number | null;
  startsAt: Date | string;
  endsAt: Date | string;
  isActive: boolean;
  stackable: boolean;
}

export interface CartPricingItemResult extends CartPricingItemInput {
  originalLineTotal: number;
  discount: number;
  lineTotal: number;
}

export interface AppliedPromoSnapshot {
  id: string;
  /** Внутреннее название (для админки) */
  name: string;
  /** Публичные названия { ro, ru, en, it } */
  publicNames?: Record<string, string>;
  code?: string | null;
  type: PromoTypeValue;
  scope: PromoScopeValue;
  discountAmount: number;
}

export interface CartPricingResult {
  items: CartPricingItemResult[];
  subtotal: number;
  discountTotal: number;
  total: number;
  appliedPromos: AppliedPromoSnapshot[];
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function isPromoActive(promo: CartPricingPromoInput, now: Date): boolean {
  if (!promo.isActive) return false;
  const startsAt = new Date(promo.startsAt);
  const endsAt = new Date(promo.endsAt);
  return now >= startsAt && now <= endsAt;
}

function matchesScope(
  promo: CartPricingPromoInput,
  item: CartPricingItemInput
): boolean {
  switch (promo.scope) {
    case "CART":
      return true;
    case "PRODUCT":
      return promo.targetIds.includes(item.productId);
    case "CATEGORY":
      return promo.targetIds.includes(item.categoryId);
    case "PRODUCT_TYPE":
      return promo.targetIds.includes(item.kind);
    default:
      return false;
  }
}

interface PromoQuote {
  promo: CartPricingPromoInput;
  perItem: number[];
  total: number;
}

function quotePromo(
  promo: CartPricingPromoInput,
  items: CartPricingItemInput[],
  lineTotals: number[]
): PromoQuote {
  const perItem = new Array(items.length).fill(0);
  const matchingIndices: number[] = [];
  items.forEach((item, index) => {
    if (matchesScope(promo, item)) matchingIndices.push(index);
  });

  if (matchingIndices.length === 0) {
    return { promo, perItem, total: 0 };
  }

  const matchingSubtotal = matchingIndices.reduce(
    (sum, i) => sum + lineTotals[i],
    0
  );
  if (matchingSubtotal <= 0) {
    return { promo, perItem, total: 0 };
  }

  if (promo.type === "PERCENT") {
    const rate = Math.min(Math.max(promo.value, 0), 100) / 100;
    for (const i of matchingIndices) {
      perItem[i] = lineTotals[i] * rate;
    }
    return { promo, perItem, total: matchingSubtotal * rate };
  }

  if (promo.type === "FIXED") {
    const totalDiscount = Math.min(Math.max(promo.value, 0), matchingSubtotal);
    const ratio = totalDiscount / matchingSubtotal;
    for (const i of matchingIndices) {
      perItem[i] = lineTotals[i] * ratio;
    }
    return { promo, perItem, total: totalDiscount };
  }

  // PRODUCT_OVERRIDE: value — новая цена за единицу для попавших товаров
  let total = 0;
  for (const i of matchingIndices) {
    const item = items[i];
    const discountPerUnit = Math.max(item.unitPrice - promo.value, 0);
    const discount = discountPerUnit * item.qty;
    perItem[i] = discount;
    total += discount;
  }
  return { promo, perItem, total };
}

export function calculateCartPricing(
  items: CartPricingItemInput[],
  promos: CartPricingPromoInput[],
  now: Date = new Date()
): CartPricingResult {
  const lineTotals = items.map((item) => round2(item.unitPrice * item.qty));
  const subtotal = round2(lineTotals.reduce((sum, v) => sum + v, 0));

  const eligible = promos.filter((promo) => {
    if (!isPromoActive(promo, now)) return false;
    if (promo.minOrderAmount != null && subtotal < promo.minOrderAmount) {
      return false;
    }
    return true;
  });

  const quotes = eligible
    .map((promo) => quotePromo(promo, items, lineTotals))
    .filter((quote) => quote.total > 0);

  const stackableQuotes = quotes.filter((q) => q.promo.stackable);
  const nonStackableQuotes = quotes.filter((q) => !q.promo.stackable);

  let bestNonStackable: PromoQuote | undefined;
  for (const quote of nonStackableQuotes) {
    if (!bestNonStackable || quote.total > bestNonStackable.total) {
      bestNonStackable = quote;
    }
  }

  const appliedQuotes = [...stackableQuotes];
  if (bestNonStackable) appliedQuotes.push(bestNonStackable);

  const combinedPerItem = new Array(items.length).fill(0);
  for (const quote of appliedQuotes) {
    quote.perItem.forEach((value, index) => {
      combinedPerItem[index] += value;
    });
  }

  const resultItems: CartPricingItemResult[] = items.map((item, index) => {
    const originalLineTotal = lineTotals[index];
    const discount = round2(
      Math.min(combinedPerItem[index], originalLineTotal)
    );
    return {
      ...item,
      originalLineTotal,
      discount,
      lineTotal: round2(Math.max(originalLineTotal - discount, 0)),
    };
  });

  const discountTotal = round2(
    resultItems.reduce((sum, item) => sum + item.discount, 0)
  );
  const total = round2(Math.max(subtotal - discountTotal, 0));

  const appliedPromos: AppliedPromoSnapshot[] = appliedQuotes.map((quote) => ({
    id: quote.promo.id,
    name: quote.promo.name,
    publicNames: quote.promo.publicNames ?? {},
    code: quote.promo.code ?? null,
    type: quote.promo.type,
    scope: quote.promo.scope,
    discountAmount: round2(quote.total),
  }));

  return {
    items: resultItems,
    subtotal,
    discountTotal,
    total,
    appliedPromos,
  };
}
