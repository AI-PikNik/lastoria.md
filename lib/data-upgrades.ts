/**
 * Разовые обновления данных при переходе на новую версию сайта.
 * Каждое выполняется один раз (id записывается в settings.dataUpgrades) и
 * ничего не перезаписывает: если админ уже что-то создал — шаг пропускается.
 * Запускаются из scripts/aapanel-update.sh (prisma/data-upgrades.ts) и из seed.
 */
import ro from "@/messages/ro.json";
import ru from "@/messages/ru.json";
import en from "@/messages/en.json";
import it from "@/messages/it.json";
import { LOCALES, type AppLocale } from "@/lib/i18n/locales";
import type { Prisma, PrismaClient } from "@/lib/generated/prisma/client";

type Messages = { pages: { faq: Record<string, { q: string; a: string }> } };
const BASE: Record<AppLocale, Messages> = { ro, ru, en, it } as Record<AppLocale, Messages>;
const FAQ_KEYS = ["q1", "q2", "q3", "q4", "q5", "q6", "q7"];

const json = (value: unknown) => value as Prisma.InputJsonValue;

interface Upgrade {
  id: string;
  title: string;
  run: (db: PrismaClient) => Promise<string>;
}

const UPGRADES: Upgrade[] = [
  {
    id: "faq-to-db-v1",
    title: "Вопросы-ответы (FAQ) перенесены в базу",
    async run(db) {
      if ((await db.faqItem.count()) > 0) return "уже есть вопросы — пропущено";
      // Правки, сделанные раньше в «Тексты страниц», важнее базового словаря
      const overrides = await db.uiTranslation.findMany({ where: { key: { startsWith: "pages.faq." } } });
      const override = (key: string, locale: AppLocale) =>
        overrides.find((o) => o.key === key && o.locale === locale)?.value;
      let created = 0;
      for (const [index, key] of FAQ_KEYS.entries()) {
        const question: Record<string, string> = {};
        const answer: Record<string, string> = {};
        for (const locale of LOCALES) {
          const base = BASE[locale].pages.faq[key];
          question[locale] = override(`pages.faq.${key}.q`, locale) ?? base?.q ?? "";
          answer[locale] = override(`pages.faq.${key}.a`, locale) ?? base?.a ?? "";
        }
        if (!Object.values(question).some(Boolean)) continue;
        await db.faqItem.create({
          data: { question: json(question), answer: json(answer), sortOrder: index + 1 },
        });
        created += 1;
      }
      return `добавлено вопросов: ${created}`;
    },
  },
  {
    id: "first-location-v1",
    title: "Первое заведение для страницы «О нас»",
    async run(db) {
      if ((await db.location.count()) > 0) return "заведения уже есть — пропущено";
      const settings = await db.settings.findUnique({ where: { id: "main" } });
      if (!settings) return "нет настроек — пропущено";
      const name = Object.fromEntries(LOCALES.map((l) => [l, settings.restaurantName]));
      await db.location.create({
        data: {
          name: json(name),
          address: settings.restaurantAddress,
          phone: settings.restaurantPhone,
          hours: json(settings.workingHours ?? {}),
          sortOrder: 1,
        },
      });
      return "создано из «Настройки → Ресторан»";
    },
  },
];

/** Выполнить недостающие обновления; возвращает журнал для вывода в консоль */
export async function runDataUpgrades(db: PrismaClient): Promise<string[]> {
  const settings = await db.settings.findUnique({ where: { id: "main" } });
  if (!settings) return ["настроек ещё нет — обновления данных отложены до seed"];
  const done = new Set(Array.isArray(settings.dataUpgrades) ? (settings.dataUpgrades as string[]) : []);
  const log: string[] = [];
  for (const upgrade of UPGRADES) {
    if (done.has(upgrade.id)) continue;
    const result = await upgrade.run(db);
    done.add(upgrade.id);
    await db.settings.update({ where: { id: "main" }, data: { dataUpgrades: json([...done]) } });
    log.push(`${upgrade.title}: ${result}`);
  }
  return log.length ? log : ["новых обновлений данных нет"];
}
