import { getTranslations } from "next-intl/server";
import { resolveLocaleParam } from "@/lib/i18n/server";
import { textPageMetadata } from "@/lib/page-meta";
import { StaticPage } from "@/components/public/static-page";

type Props = PageProps<"/[locale]/privacy">;

export async function generateMetadata({ params }: Props) {
  return textPageMetadata(await resolveLocaleParam(params), "privacy", "/privacy");
}

export default async function PrivacyPage({ params }: Props) {
  const locale = await resolveLocaleParam(params);
  const t = await getTranslations({ locale, namespace: "pages.privacy" });
  return (
    <StaticPage locale={locale} title={t("h1")} path="/privacy">
      <p>{t("body.p1")}</p>
      <p>{t("body.p2")}</p>
      <p>{t("body.p3")}</p>
      <p>{t("body.p4")}</p>
    </StaticPage>
  );
}
