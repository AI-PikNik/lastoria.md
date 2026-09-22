import { getTranslations } from "next-intl/server";
import { Phone } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { telHref, type PublicSettings } from "@/lib/settings";
import type { AppLocale } from "@/lib/i18n/locales";
import { FlagStripe } from "@/theme/decor";
import { BrandLogo } from "./brand-logo";
import { NavLinks } from "./nav-links";
import { LanguageSwitcher } from "./language-switcher";
import { HeaderCartButton } from "./header-cart-button";
import { MobileMenu } from "./mobile-menu";

export async function Header({ locale, settings }: { locale: AppLocale; settings: PublicSettings }) {
  const [t, tMeta] = await Promise.all([
    getTranslations({ locale, namespace: "nav" }),
    getTranslations({ locale, namespace: "meta" }),
  ]);

  return (
    <header className="sticky top-0 z-40 border-b border-border-strong/60 bg-background/95 shadow-[0_1px_0_rgba(199,161,90,0.25)] backdrop-blur supports-[backdrop-filter]:bg-background/85">
      <FlagStripe />
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-2 px-4 sm:h-[72px] lg:gap-6">
        <MobileMenu phone={settings.phone} phoneHref={telHref(settings.phone)} hours={settings.hours} />
        <Link href="/" className="mr-auto shrink-0 rounded-md lg:mr-0" aria-label={`${settings.name} — ${t("home")}`}>
          <BrandLogo name={settings.name} logoUrl={settings.logoUrl} subtitle={tMeta("subtitle")} />
        </Link>
        <nav aria-label={t("mainNav")} className="hidden flex-1 justify-center lg:flex">
          <NavLinks className="flex items-center gap-7" itemClassName="text-[0.95rem]" />
        </nav>
        <div className="flex items-center gap-1 sm:gap-2">
          <a
            href={telHref(settings.phone)}
            className="hidden h-11 items-center gap-2 rounded-md px-2 text-sm font-semibold text-foreground/85 hover:text-primary xl:inline-flex"
          >
            <Phone className="size-4" aria-hidden="true" />
            {settings.phone}
          </a>
          <div className="hidden lg:block">
            <LanguageSwitcher />
          </div>
          <HeaderCartButton />
        </div>
      </div>
    </header>
  );
}
