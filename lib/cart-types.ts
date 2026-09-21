export interface LocalCartItem {
  productId: string;
  variantName?: string | null;
  qty: number;
}

export const CART_STORAGE_KEY = "lastoria:cart";
