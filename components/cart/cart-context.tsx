"use client";

import * as React from "react";
import { CART_STORAGE_KEY, type LocalCartItem } from "@/lib/cart-types";

interface CartContextValue {
  items: LocalCartItem[];
  totalQty: number;
  addItem: (item: LocalCartItem) => void;
  updateQty: (productId: string, variantName: string | null | undefined, qty: number) => void;
  removeItem: (productId: string, variantName?: string | null) => void;
  clear: () => void;
}

const CartContext = React.createContext<CartContextValue | null>(null);

function sameLine(a: LocalCartItem, productId: string, variantName?: string | null) {
  return a.productId === productId && (a.variantName ?? null) === (variantName ?? null);
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = React.useState<LocalCartItem[]>([]);
  const [hydrated, setHydrated] = React.useState(false);

  React.useEffect(() => {
    // Откладываем чтение localStorage на микротаск, чтобы не вызывать
    // setState синхронно в теле эффекта.
    queueMicrotask(() => {
      try {
        const raw = window.localStorage.getItem(CART_STORAGE_KEY);
        if (raw) setItems(JSON.parse(raw));
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

  const addItem = React.useCallback((item: LocalCartItem) => {
    setItems((prev) => {
      const existing = prev.find((i) => sameLine(i, item.productId, item.variantName));
      if (existing) {
        return prev.map((i) =>
          sameLine(i, item.productId, item.variantName)
            ? { ...i, qty: i.qty + item.qty }
            : i
        );
      }
      return [...prev, item];
    });
  }, []);

  const updateQty = React.useCallback(
    (productId: string, variantName: string | null | undefined, qty: number) => {
      setItems((prev) => {
        if (qty <= 0) {
          return prev.filter((i) => !sameLine(i, productId, variantName));
        }
        return prev.map((i) =>
          sameLine(i, productId, variantName) ? { ...i, qty } : i
        );
      });
    },
    []
  );

  const removeItem = React.useCallback((productId: string, variantName?: string | null) => {
    setItems((prev) => prev.filter((i) => !sameLine(i, productId, variantName)));
  }, []);

  const clear = React.useCallback(() => setItems([]), []);

  const totalQty = items.reduce((sum, i) => sum + i.qty, 0);

  return (
    <CartContext.Provider value={{ items, totalQty, addItem, updateQty, removeItem, clear }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = React.useContext(CartContext);
  if (!ctx) throw new Error("useCart должен использоваться внутри CartProvider");
  return ctx;
}
