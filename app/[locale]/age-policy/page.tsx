import { getTranslations } from "next-intl/server";
import { resolveLocaleParam } from "@/lib/i18n/server";
import { textPageMetadata } from "@/lib/page-meta";
import { StaticPage } from "@/components/public/static-page";

type Props = PageProps<"/[locale]/age-policy">;

export async function generateMetadata({ params }: Props) {
  return textPageMetadata(await resolveLocaleParam(params), "agePolicy", "/age-policy");
}

export default async function AgePolicyPage({ params }: Props) {
  const locale = await resolveLocaleParam(params);
  const t = await getTranslations({ locale, namespace: "pages.agePolicy" });
  return (
    <StaticPage locale={locale} title={t("h1")} path="/age-policy">
      <p>{t("body.p1")}</p>
      <p>{t("body.p2")}</p>
    </StaticPage>
  );
}
