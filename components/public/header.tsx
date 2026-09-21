import Link from "next/link";
import { HeaderCartLink } from "./header-cart-link";

const NAV_LINKS = [
  { href: "/menu", label: "Меню" },
  { href: "/delivery", label: "Доставка" },
  { href: "/about", label: "О нас" },
  { href: "/contacts", label: "Контакты" },
];

export function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
        <Link href="/" className="font-display text-xl font-semibold text-primary">
          La Storia
        </Link>
        <nav aria-label="Основная навигация" className="hidden gap-6 md:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-foreground/80 hover:text-primary"
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-3">
          <a
            href="tel:+37322000000"
            className="hidden text-sm font-medium sm:block"
            aria-label="Позвонить в La Storia"
          >
            +373 22 000 000
          </a>
          <HeaderCartLink />
        </div>
      </div>
    </header>
  );
}
