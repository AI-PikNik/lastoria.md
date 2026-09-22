import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import type { AppLocale } from "@/lib/i18n/locales";
import { Breadcrumbs } from "./breadcrumbs";
import { Plaque, SectionTitle } from "@/theme/decor";

/** Оформление текстовых страниц: крошки, заголовок с ветвями, пергаментная плашка */
export async function StaticPage({
  locale,
  title,
  path,
  children,
  after,
}: {
  locale: AppLocale;
  title: string;
  path: string;
  children: ReactNode;
  after?: ReactNode;
}) {
  const tNav = await getTranslations({ locale, namespace: "nav" });
  return (
    <div className="mx-auto max-w-3xl px-4 pt-5">
      <Breadcrumbs
        locale={locale}
        label={tNav("breadcrumbs")}
        items={[
          { name: tNav("home"), path: "/" },
          { name: title, path },
        ]}
      />
      <SectionTitle as="h1" title={title} className="my-6" />
      <Plaque className="space-y-4 px-5 py-6 leading-relaxed sm:px-8">{children}</Plaque>
      {after}
    </div>
  );
}
