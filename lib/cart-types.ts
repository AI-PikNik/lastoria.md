export interface LocalCartItem {
  productId: string;
  /** Ключ варианта (размер/объём), см. lib/variants.ts */
  variantKey?: string | null;
  qty: number;
}

/** v2: варианты хранятся по ключу, а не по названию (названия теперь на 4 языках) */
export const CART_STORAGE_KEY = "lastoria:cart:v2";
export const PROMO_CODE_STORAGE_KEY = "lastoria:promo-code";
