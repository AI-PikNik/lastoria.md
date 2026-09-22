import { getTranslations } from "next-intl/server";
import { resolveLocaleParam } from "@/lib/i18n/server";
import { textPageMetadata } from "@/lib/page-meta";
import { StaticPage } from "@/components/public/static-page";
import { ConsentControls } from "@/components/public/consent/consent-controls";

type Props = PageProps<"/[locale]/cookies">;

export async function generateMetadata({ params }: Props) {
  return textPageMetadata(await resolveLocaleParam(params), "cookies", "/cookies");
}

export default async function CookiesPage({ params }: Props) {
  const locale = await resolveLocaleParam(params);
  const t = await getTranslations({ locale, namespace: "pages.cookies" });
  return (
    <StaticPage locale={locale} title={t("h1")} path="/cookies">
      <p>{t("body.p1")}</p>
      <p>{t("body.p2")}</p>
      <p>{t("body.p3")}</p>
      <h2 className="font-display text-xl font-bold text-primary">{t("reset")}</h2>
      <ConsentControls />
    </StaticPage>
  );
}
