import { getTranslations } from "next-intl/server";
import { resolveLocaleParam } from "@/lib/i18n/server";
import { textPageMetadata } from "@/lib/page-meta";
import { getPublicSettings } from "@/lib/settings";
import { getFaqItems } from "@/lib/faq";
import { StaticPage } from "@/components/public/static-page";
import { Faq } from "@/components/public/faq";

type Props = PageProps<"/[locale]/about">;

export async function generateMetadata({ params }: Props) {
  return textPageMetadata(await resolveLocaleParam(params), "about", "/about");
}

export default async function AboutPage({ params }: Props) {
  const locale = await resolveLocaleParam(params);
  const [t, tHome, settings] = await Promise.all([
    getTranslations({ locale, namespace: "pages.about" }),
    getTranslations({ locale, namespace: "home" }),
    getPublicSettings(locale),
  ]);
  const faq = await getFaqItems(locale, settings);
  return (
    <StaticPage
      locale={locale}
      title={t("h1")}
      path="/about"
      after={<Faq title={t("faqTitle")} items={faq} locale={locale} />}
    >
      <p>{t("body.p1")}</p>
      <p>{t("body.p2")}</p>
      <p className="font-accent text-lg italic text-brick">{tHome("story.p1")}</p>
      <p>{tHome("story.p2")}</p>
    </StaticPage>
  );
}
