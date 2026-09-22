import { getTranslations } from "next-intl/server";
import { resolveLocaleParam } from "@/lib/i18n/server";
import { textPageMetadata } from "@/lib/page-meta";
import { getPublicSettings } from "@/lib/settings";
import { getDeliveryCities } from "@/lib/delivery-data";
import { getFaqItems } from "@/lib/faq";
import { formatMoney } from "@/lib/format";
import { StaticPage } from "@/components/public/static-page";
import { Faq } from "@/components/public/faq";

type Props = PageProps<"/[locale]/delivery">;

export async function generateMetadata({ params }: Props) {
  return textPageMetadata(await resolveLocaleParam(params), "delivery", "/delivery");
}

export default async function DeliveryPage({ params }: Props) {
  const locale = await resolveLocaleParam(params);
  const [t, tCheckout, settings, cities] = await Promise.all([
    getTranslations({ locale, namespace: "pages.delivery" }),
    getTranslations({ locale, namespace: "checkout" }),
    getPublicSettings(locale),
    getDeliveryCities(locale),
  ]);
  const faq = await getFaqItems(locale, settings);
  const money = (v: number) => formatMoney(v, locale);

  return (
    <StaticPage
      locale={locale}
      title={t("h1")}
      path="/delivery"
      after={<Faq title={t("faqTitle")} items={faq} locale={locale} />}
    >
      <p>
        {t("minOrder", { amount: money(settings.minOrderAmount) })}{" "}
        {settings.hours && t("hours", { hours: settings.hours })}
      </p>

      {cities.map((city) => (
        <section key={city.id} aria-labelledby={`city-${city.slug}`}>
          <h2 id={`city-${city.slug}`} className="mb-2 font-display text-xl font-bold text-primary">
            {t("zonesTitle")} — {city.name}
          </h2>
          <div className="overflow-hidden rounded-lg border border-border-strong/60 bg-card">
            <table className="w-full text-left text-[0.95rem]">
              <thead className="bg-surface text-sm">
                <tr>
                  <th scope="col" className="px-4 py-2.5 font-semibold">
                    {t("zoneCol")}
                  </th>
                  <th scope="col" className="px-4 py-2.5 text-right font-semibold">
                    {t("feeCol")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {city.zones.map((zone) => (
                  <tr key={zone.id} className="border-t border-border">
                    <td className="px-4 py-2.5">{zone.name}</td>
                    <td className="px-4 py-2.5 text-right">
                      {zone.fee > 0 ? money(zone.fee) : tCheckout("free")}
                      {zone.freeFrom ? (
                        <span className="block text-xs text-muted-foreground">
                          {tCheckout("freeFrom", { amount: money(zone.freeFrom) })}
                        </span>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}

      <h2 className="font-display text-xl font-bold text-primary">{t("pickupTitle")}</h2>
      <p>{t("pickupText", { address: settings.address })}</p>
      <h2 className="font-display text-xl font-bold text-primary">{t("paymentTitle")}</h2>
      <p>{t("paymentText")}</p>
    </StaticPage>
  );
}
