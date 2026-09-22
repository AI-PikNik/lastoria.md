import { getTranslations } from "next-intl/server";
import { resolveLocaleParam } from "@/lib/i18n/server";
import { textPageMetadata } from "@/lib/page-meta";
import { StaticPage } from "@/components/public/static-page";

type Props = PageProps<"/[locale]/terms">;

export async function generateMetadata({ params }: Props) {
  return textPageMetadata(await resolveLocaleParam(params), "terms", "/terms");
}

export default async function TermsPage({ params }: Props) {
  const locale = await resolveLocaleParam(params);
  const t = await getTranslations({ locale, namespace: "pages.terms" });
  return (
    <StaticPage locale={locale} title={t("h1")} path="/terms">
      <p>{t("body.p1")}</p>
      <p>{t("body.p2")}</p>
      <p>{t("body.p3")}</p>
    </StaticPage>
  );
}
