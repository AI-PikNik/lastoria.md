import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { fontVariables } from "@/theme/fonts";

export const metadata: Metadata = {
  title: "404 — La Storia",
  robots: { index: false, follow: false },
};

/** 404 для адресов вне языковых разделов (например, /admin/несуществующее) */
export default function GlobalNotFound() {
  return (
    <html lang="ro" className={fontVariables}>
      <body className="paper-texture flex min-h-screen items-center justify-center p-4 font-sans">
        <div className="plaque max-w-md px-8 py-10 text-center">
          <p className="font-display text-6xl font-extrabold italic text-primary">404</p>
          <p className="mt-3 text-lg">Pagina nu a fost găsită · Page not found</p>
          <Link href="/" className="mt-6 inline-flex h-11 items-center rounded-md bg-primary px-5 font-semibold text-primary-foreground">
            La Storia
          </Link>
        </div>
      </body>
    </html>
  );
}
