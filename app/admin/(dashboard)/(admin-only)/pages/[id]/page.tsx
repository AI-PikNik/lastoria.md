import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { BASE_MESSAGES } from "@/lib/i18n/messages";
import { flattenMessages } from "@/lib/i18n/messages-utils";
import { LOCALES, type AppLocale } from "@/lib/i18n/locales";
import { findPageTextGroup } from "@/lib/page-texts";
import { BackButton } from "@/components/admin/back-button";
import { PageTextsForm } from "@/components/admin/page-texts-form";

export const metadata = { title: "Тексты страницы" };
export const dynamic = "force-dynamic";

export default async function AdminPageTexts({ params }: PageProps<"/admin/pages/[id]">) {
  const { id } = await params;
  const group = findPageTextGroup(id);
  if (!group) notFound();

  const keys = group.fields.map((f) => f.key);
  const overrides = await prisma.uiTranslation.findMany({ where: { key: { in: keys } } });
  const base = Object.fromEntries(LOCALES.map((l) => [l, flattenMessages(BASE_MESSAGES[l])])) as Record<AppLocale, Record<string, string>>;

  // Текущее значение каждого поля: правка из админки или текст по умолчанию
  const values: Record<string, Record<AppLocale, string>> = {};
  const defaults: Record<string, Record<AppLocale, string>> = {};
  for (const key of keys) {
    values[key] = {} as Record<AppLocale, string>;
    defaults[key] = {} as Record<AppLocale, string>;
    for (const l of LOCALES) {
      defaults[key][l] = base[l][key] ?? "";
      values[key][l] = overrides.find((o) => o.key === key && o.locale === l)?.value ?? defaults[key][l];
    }
  }

  return (
    <div className="space-y-4">
      <BackButton fallback="/admin/pages" label="Все страницы" />
      <div>
        <h1 className="font-display text-2xl font-bold">{group.title}</h1>
        {group.description && <p className="text-sm text-muted-foreground">{group.description}</p>}
      </div>
      <PageTextsForm group={group} values={values} defaults={defaults} />
    </div>
  );
}
