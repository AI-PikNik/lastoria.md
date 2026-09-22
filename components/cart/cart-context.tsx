"use client";

import * as React from "react";
import { CART_STORAGE_KEY, PROMO_CODE_STORAGE_KEY, type LocalCartItem } from "@/lib/cart-types";

interface CartContextValue {
  items: LocalCartItem[];
  totalQty: number;
  hydrated: boolean;
  promoCode: string;
  setPromoCode: (code: string) => void;
  addItem: (item: LocalCartItem) => void;
  updateQty: (productId: string, variantKey: string | null | undefined, qty: number) => void;
  removeItem: (productId: string, variantKey?: string | null) => void;
  /** Убрать из корзины товары, которых больше нет в продаже */
  removeProducts: (productIds: string[]) => void;
  clear: () => void;
}

const CartContext = React.createContext<CartContextValue | null>(null);

function sameLine(a: LocalCartItem, productId: string, variantKey?: string | null) {
  return a.productId === productId && (a.variantKey ?? null) === (variantKey ?? null);
}

function sanitize(raw: unknown): LocalCartItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((i): i is LocalCartItem => !!i && typeof i.productId === "string" && Number(i.qty) > 0)
    .map((i) => ({ productId: i.productId, variantKey: i.variantKey ?? null, qty: Math.min(Math.trunc(Number(i.qty)), 50) }))
    .slice(0, 50);
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = React.useState<LocalCartItem[]>([]);
  const [hydrated, setHydrated] = React.useState(false);
  const [promoCode, setPromoCodeState] = React.useState("");

  React.useEffect(() => {
    // Откладываем чтение localStorage на микротаск, чтобы не вызывать
    // setState синхронно в теле эффекта.
    queueMicrotask(() => {
      try {
        const raw = window.localStorage.getItem(CART_STORAGE_KEY);
        if (raw) setItems(sanitize(JSON.parse(raw)));
        setPromoCodeState(window.localStorage.getItem(PROMO_CODE_STORAGE_KEY) ?? "");
      } catch {
        // localStorage недоступен — работаем с пустой корзиной
      }
      setHydrated(true);
    });
  }, []);

  React.useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
    } catch {
      // ignore
    }
  }, [items, hydrated]);

  // Синхронизация между вкладками браузера
  React.useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== CART_STORAGE_KEY) return;
      try {
        setItems(sanitize(JSON.parse(event.newValue ?? "[]")));
      } catch {
        // ignore
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const setPromoCode = React.useCallback((code: string) => {
    setPromoCodeState(code);
    try {
      if (code) window.localStorage.setItem(PROMO_CODE_STORAGE_KEY, code);
      else window.localStorage.removeItem(PROMO_CODE_STORAGE_KEY);
    } catch {
      // ignore
    }
  }, []);

  const addItem = React.useCallback((item: LocalCartItem) => {
    setItems((prev) => {
      const key = item.variantKey ?? null;
      const existing = prev.find((i) => sameLine(i, item.productId, key));
      if (existing) {
        return prev.map((i) =>
          sameLine(i, item.productId, key) ? { ...i, qty: Math.min(i.qty + item.qty, 50) } : i
        );
      }
      return [...prev, { productId: item.productId, variantKey: key, qty: Math.min(item.qty, 50) }];
    });
  }, []);

  const updateQty = React.useCallback(
    (productId: string, variantKey: string | null | undefined, qty: number) => {
      setItems((prev) => {
        if (qty <= 0) {
          return prev.filter((i) => !sameLine(i, productId, variantKey));
        }
        return prev.map((i) =>
          sameLine(i, productId, variantKey) ? { ...i, qty: Math.min(qty, 50) } : i
        );
      });
    },
    []
  );

  const removeItem = React.useCallback((productId: string, variantKey?: string | null) => {
    setItems((prev) => prev.filter((i) => !sameLine(i, productId, variantKey)));
  }, []);

  const removeProducts = React.useCallback((productIds: string[]) => {
    if (productIds.length === 0) return;
    setItems((prev) => prev.filter((i) => !productIds.includes(i.productId)));
  }, []);

  const clear = React.useCallback(() => {
    setItems([]);
    setPromoCode("");
  }, [setPromoCode]);

  const totalQty = items.reduce((sum, i) => sum + i.qty, 0);

  const value = React.useMemo(
    () => ({ items, totalQty, hydrated, promoCode, setPromoCode, addItem, updateQty, removeItem, removeProducts, clear }),
    [items, totalQty, hydrated, promoCode, setPromoCode, addItem, updateQty, removeItem, removeProducts, clear]
  );

  return (
    <CartContext.Provider value={value}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = React.useContext(CartContext);
  if (!ctx) throw new Error("useCart должен использоваться внутри CartProvider");
  return ctx;
}
