import { getTranslations } from "next-intl/server";
import { Clock, Mail, MapPin, Phone } from "lucide-react";
import { resolveLocaleParam } from "@/lib/i18n/server";
import { textPageMetadata } from "@/lib/page-meta";
import { getPublicSettings, telHref } from "@/lib/settings";
import { StaticPage } from "@/components/public/static-page";

type Props = PageProps<"/[locale]/contacts">;

export async function generateMetadata({ params }: Props) {
  return textPageMetadata(await resolveLocaleParam(params), "contacts", "/contacts");
}

export default async function ContactsPage({ params }: Props) {
  const locale = await resolveLocaleParam(params);
  const [t, settings] = await Promise.all([
    getTranslations({ locale, namespace: "pages.contacts" }),
    getPublicSettings(locale),
  ]);
  const mapQuery = settings.geo ? `${settings.geo.lat},${settings.geo.lng}` : settings.address;

  return (
    <StaticPage locale={locale} title={t("h1")} path="/contacts">
      <address className="not-italic">
        <dl className="grid gap-4 sm:grid-cols-2">
          <Item icon={<Phone />} label={t("phone")}>
            <a href={telHref(settings.phone)} className="font-semibold text-primary hover:underline">
              {settings.phone}
            </a>
          </Item>
          {settings.email && (
            <Item icon={<Mail />} label={t("email")}>
              <a href={`mailto:${settings.email}`} className="font-semibold text-primary hover:underline">
                {settings.email}
              </a>
            </Item>
          )}
          <Item icon={<MapPin />} label={t("address")}>
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapQuery)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:underline"
            >
              {settings.address}
            </a>
          </Item>
          {settings.hours && (
            <Item icon={<Clock />} label={t("hours")}>
              {settings.hours}
            </Item>
          )}
        </dl>
      </address>
    </StaticPage>
  );
}

function Item({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3 rounded-lg bg-card p-4 gold-frame">
      <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-full bg-olive text-cream [&_svg]:size-5">
        {icon}
      </span>
      <div>
        <dt className="text-sm text-muted-foreground">{label}</dt>
        <dd>{children}</dd>
      </div>
    </div>
  );
}
