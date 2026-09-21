import type { ReactNode } from "react";
import { CartProvider } from "@/components/cart/cart-context";
import { AgeGateProvider } from "@/components/age-gate/age-gate-context";
import { Header } from "@/components/public/header";
import { Footer } from "@/components/public/footer";
import { StickyCartBar } from "@/components/public/sticky-cart-bar";

export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <CartProvider>
      <AgeGateProvider>
        <Header />
        <main className="flex-1 pb-20 md:pb-0">{children}</main>
        <Footer />
        <StickyCartBar />
      </AgeGateProvider>
    </CartProvider>
  );
}
