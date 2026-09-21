import type { Metadata } from "next";
import { CartView } from "@/components/public/cart-view";

export const metadata: Metadata = {
  title: "Корзина",
  robots: { index: false, follow: false },
};

export default function CartPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="mb-6 font-display text-3xl font-bold">Корзина</h1>
      <CartView />
    </div>
  );
}
