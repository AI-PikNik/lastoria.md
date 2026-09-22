import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Toaster } from "sonner";
import "../globals.css";
import { fontVariables } from "@/theme/fonts";

export const metadata: Metadata = {
  title: { default: "Админ-панель La Storia", template: "%s | Админка La Storia" },
  robots: { index: false, follow: false },
};

/** Корневой лейаут админки: всегда на русском, нейтральная плотная тема */
export default function AdminRootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ru" className={`${fontVariables} h-full antialiased`}>
      <body data-theme="admin" className="min-h-full bg-background font-sans text-[0.9375rem] text-foreground">
        {children}
        <Toaster richColors position="top-center" closeButton />
      </body>
    </html>
  );
}
