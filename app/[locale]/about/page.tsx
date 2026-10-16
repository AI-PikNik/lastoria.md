import { getTranslations } from "next-intl/server";
import { Clock, MapPin, Phone } from "lucide-react";
import { resolveLocaleParam } from "@/lib/i18n/server";
import { textPageMetadata } from "@/lib/page-meta";
import { telHref } from "@/lib/settings";
import { getPublicLocations, type PublicLocation } from "@/lib/locations";
import { StaticPage } from "@/components/public/static-page";
import { LocationGallery } from "@/components/public/location-gallery";
import { Plaque, SectionTitle } from "@/theme/decor";

type Props = PageProps<"/[locale]/about">;

export async function generateMetadata({ params }: Props) {
  return textPageMetadata(await resolveLocaleParam(params), "about", "/about");
}

export default async function AboutPage({ params }: Props) {
  const locale = await resolveLocaleParam(params);
  const [t, tContacts, locations] = await Promise.all([
    getTranslations({ locale, namespace: "pages.about" }),
    getTranslations({ locale, namespace: "pages.contacts" }),
    getPublicLocations(locale),
  ]);
  const labels = {
    address: tContacts("address"),
    phone: tContacts("phone"),
    hours: tContacts("hours"),
    openMap: t("openMap"),
    gallery: t("gallery"),
    photo: t("photo"),
    close: t("close"),
    prev: t("prev"),
    next: t("next"),
  };

  return (
    <StaticPage
      locale={locale}
      title={t("h1")}
      path="/about"
      after={
        locations.length > 0 && (
          <section className="mt-10" aria-labelledby="locations-title">
            {t("locationsTitle") && (
              <SectionTitle as="h2" id="locations-title" title={t("locationsTitle")} className="mb-6" />
            )}
            <div className="space-y-6">
              {locations.map((location) => (
                <LocationBlock key={location.id} location={location} labels={labels} />
              ))}
            </div>
          </section>
        )
      }
    >
      {t("body.p1") && <p>{t("body.p1")}</p>}
      {t("body.p2") && <p>{t("body.p2")}</p>}
      {t("body.p3") && <p className="font-accent text-lg italic text-brick">{t("body.p3")}</p>}
      {t("body.p4") && <p>{t("body.p4")}</p>}
    </StaticPage>
  );
}

function LocationBlock({
  location,
  labels,
}: {
  location: PublicLocation;
  labels: Record<"address" | "phone" | "hours" | "openMap" | "gallery" | "photo" | "close" | "prev" | "next", string>;
}) {
  const mapHref =
    location.mapUrl ||
    (location.address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location.address)}` : null);
  return (
    <Plaque className="space-y-4 px-5 py-6 sm:px-8">
      <h3 className="font-display text-2xl font-bold text-primary">{location.name}</h3>
      {location.description && (
        <div className="space-y-3 leading-relaxed">
          {location.description.split(/\n{2,}/).map((paragraph, i) => (
            <p key={i} className="whitespace-pre-line">
              {paragraph}
            </p>
          ))}
        </div>
      )}
      <address className="grid gap-3 not-italic sm:grid-cols-3">
        {location.address && (
          <Fact icon={<MapPin />} label={labels.address}>
            {mapHref ? (
              <a href={mapHref} target="_blank" rel="noopener noreferrer" className="font-semibold text-primary hover:underline">
                {location.address}
              </a>
            ) : (
              location.address
            )}
          </Fact>
        )}
        {location.phone && (
          <Fact icon={<Phone />} label={labels.phone}>
            <a href={telHref(location.phone)} className="font-semibold text-primary hover:underline">
              {location.phone}
            </a>
          </Fact>
        )}
        {location.hours && (
          <Fact icon={<Clock />} label={labels.hours}>
            {location.hours}
          </Fact>
        )}
      </address>
      {location.images.length > 0 && (
        <div className="space-y-2">
          <h4 className="font-display text-lg font-bold text-primary">{labels.gallery}</h4>
          <LocationGallery images={location.images} title={location.name} labels={labels} />
        </div>
      )}
    </Plaque>
  );
}

function Fact({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <span aria-hidden="true" className="mt-0.5 text-gold [&_svg]:size-5">
        {icon}
      </span>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
        <div className="text-[0.95rem]">{children}</div>
      </div>
    </div>
  );
}
