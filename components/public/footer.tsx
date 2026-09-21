import Link from "next/link";

const FOOTER_LINKS = [
  { href: "/about", label: "О нас" },
  { href: "/delivery", label: "Доставка и оплата" },
  { href: "/contacts", label: "Контакты" },
  { href: "/age-policy", label: "Продажа алкоголя 18+" },
  { href: "/privacy", label: "Политика конфиденциальности" },
  { href: "/terms", label: "Публичная оферта" },
];

export function Footer() {
  return (
    <footer className="mt-16 border-t border-border bg-charcoal text-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 md:flex-row md:justify-between">
        <div>
          <p className="font-display text-lg font-semibold">La Storia</p>
          <p className="mt-2 max-w-sm text-sm text-white/70">
            Пиццерия в Кишинёве. Пицца, напитки и десерты с доставкой или самовывозом.
          </p>
          <p className="mt-4 text-sm text-white/70">
            <a href="tel:+37322000000" className="hover:text-white">
              +373 22 000 000
            </a>
          </p>
        </div>
        <nav aria-label="Информация" className="grid grid-cols-2 gap-2 text-sm md:grid-cols-1">
          {FOOTER_LINKS.map((link) => (
            <Link key={link.href} href={link.href} className="text-white/70 hover:text-white">
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
      <div className="border-t border-white/10 py-4 text-center text-xs text-white/50">
        © {new Date().getFullYear()} La Storia. Республика Молдова.
      </div>
    </footer>
  );
}
