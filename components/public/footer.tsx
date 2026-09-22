import { getTranslations } from "next-intl/server";
import { Clock, MapPin, Phone } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { telHref, type PublicSettings } from "@/lib/settings";
import type { AppLocale } from "@/lib/i18n/locales";
import { CheckeredStrip, FlagMark, OliveBranch, TextLogo } from "@/theme/decor";

const FOOTER_LINKS = [
  { href: "/about", key: "about" },
  { href: "/delivery", key: "delivery" },
  { href: "/contacts", key: "contacts" },
  { href: "/age-policy", key: "agePolicy" },
  { href: "/privacy", key: "privacy" },
  { href: "/terms", key: "terms" },
  { href: "/cookies", key: "cookies" },
] as const;

export async function Footer({ locale, settings }: { locale: AppLocale; settings: PublicSettings }) {
  const [t, tMeta] = await Promise.all([
    getTranslations({ locale, namespace: "footer" }),
    getTranslations({ locale, namespace: "meta" }),
  ]);

  return (
    <footer className="mt-16 text-cream">
      <CheckeredStrip />
      <div className="bg-charcoal">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-2 lg:grid-cols-[1.3fr_1fr_1fr]">
          <div>
            <TextLogo
              name={settings.name}
              subtitle={tMeta("subtitle")}
              className="[&>span:first-child]:text-fire-light [&>span:last-child]:text-cream/80"
            />
            <p className="mt-3 max-w-sm text-sm text-cream/75">{t("about")}</p>
            <p className="mt-3 font-accent text-lg italic text-gold">{tMeta("tagline")}</p>
            <div className="mt-3 flex items-center gap-2">
              <FlagMark />
              <OliveBranch className="text-gold" />
            </div>
          </div>
          <div className="space-y-3 text-sm">
            <p className="font-display text-base font-semibold text-fire-light">{t("info")}</p>
            <a href={telHref(settings.phone)} className="flex min-h-11 items-center gap-2 text-cream/85 hover:text-cream">
              <Phone className="size-4 shrink-0" aria-hidden="true" />
              <span>
                <span className="sr-only">{t("phone")}: </span>
                {settings.phone}
              </span>
            </a>
            <p className="flex items-start gap-2 text-cream/85">
              <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <span>
                <span className="sr-only">{t("address")}: </span>
                {settings.address}
              </span>
            </p>
            {settings.hours && (
              <p className="flex items-start gap-2 text-cream/85">
                <Clock className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <span>
                  <span className="sr-only">{t("hours")}: </span>
                  {settings.hours}
                </span>
              </p>
            )}
          </div>
          <nav aria-label={t("info")} className="text-sm">
            <ul className="grid grid-cols-1 gap-x-4 sm:grid-cols-1">
              {FOOTER_LINKS.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="inline-flex min-h-10 items-center text-cream/80 hover:text-cream hover:underline">
                    {t(`links.${link.key}`)}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
        <div className="border-t border-cream/10">
          <p className="mx-auto max-w-6xl px-4 py-4 text-xs text-cream/60">
            © {new Date().getFullYear()} {settings.name}. {t("rights")}
          </p>
        </div>
        <div aria-hidden="true" className="flag-stripe h-1" />
      </div>
    </footer>
  );
}
