/**
 * Стартовые данные La Storia: админ, настройки, группы и товары на 4 языках
 * (ro, ru, en, it), промо, город Кишинёв с районами доставки, демо-заказы.
 *
 * Скрипт можно запускать повторно: он НЕ перезаписывает то, что уже изменено
 * в админке — только добавляет недостающее (переводы, районы, настройки).
 * Цены доставки по районам — ПЛЕЙСХОЛДЕРЫ, их нужно поправить в админке.
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/format";
import { LOCALES, type AppLocale } from "@/lib/i18n/locales";
import type { Prisma } from "@/lib/generated/prisma/client";
import { generatePlaceholder } from "./seed-placeholders";

type L10n = Record<AppLocale, string>;

/** Дополнить JSON-карту { ro, ru, en, it } недостающими языками */
function fillMap(existing: unknown, defaults: L10n): L10n {
  const current = (existing && typeof existing === "object" ? existing : {}) as Partial<L10n>;
  const result = { ...defaults };
  for (const l of LOCALES) if (current[l]?.trim()) result[l] = current[l]!;
  return result;
}

const json = (value: unknown) => value as Prisma.InputJsonValue;

async function main() {
  console.log("Seeding database…");

  /* ─────────── Администратор ─────────── */
  const adminEmail = process.env.ADMIN_EMAIL ?? "admin@lastoria.md";
  const adminPassword = process.env.ADMIN_PASSWORD ?? "admin12345";
  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      name: process.env.ADMIN_NAME ?? "Admin",
      passwordHash: await bcrypt.hash(adminPassword, 10),
      role: "ADMIN",
    },
  });
  console.log(`Admin user ready: ${adminEmail}`);

  /* ─────────── Настройки ─────────── */
  const hours: L10n = {
    ro: "Zilnic, 10:00–22:00",
    ru: "Ежедневно, 10:00–22:00",
    en: "Daily, 10:00–22:00",
    it: "Tutti i giorni, 10:00–22:00",
  };
  const seoTitles: L10n = {
    ro: "La Storia — pizzerie italiană tradițională în Chișinău",
    ru: "La Storia — традиционная итальянская пиццерия в Кишинёве",
    en: "La Storia — traditional Italian pizzeria in Chișinău",
    it: "La Storia — pizzeria tradizionale italiana a Chișinău",
  };
  const seoDescriptions: L10n = {
    ro: "Pizza italiană, băuturi și deserturi cu livrare în Chișinău sau ridicare personală. Comandă online, operatorul te sună pentru confirmare.",
    ru: "Итальянская пицца, напитки и десерты с доставкой по Кишинёву или самовывозом. Закажите онлайн — оператор перезвонит для подтверждения.",
    en: "Italian pizza, drinks and desserts with delivery in Chișinău or pickup. Order online and an operator will call you to confirm.",
    it: "Pizza italiana, bevande e dolci con consegna a Chișinău o ritiro in sede. Ordina online, un operatore ti richiamerà per confermare.",
  };
  const existingSettings = await prisma.settings.findUnique({ where: { id: "main" } });
  if (existingSettings) {
    await prisma.settings.update({
      where: { id: "main" },
      data: {
        workingHours: json(fillMap(existingSettings.workingHours, hours)),
        seoTitles: json(fillMap(existingSettings.seoTitles, seoTitles)),
        seoDescriptions: json(fillMap(existingSettings.seoDescriptions, seoDescriptions)),
      },
    });
  } else {
    await prisma.settings.create({
      data: {
        id: "main",
        restaurantName: "La Storia",
        // ПЛЕЙСХОЛДЕРЫ — замените в админке: Настройки → Ресторан
        restaurantPhone: "+373 22 000 000",
        restaurantAddress: "str. Ștefan cel Mare 1, Chișinău, Republica Moldova",
        restaurantEmail: "hello@lastoria.md",
        workingHours: json(hours),
        minOrderAmount: 100,
        seoTitles: json(seoTitles),
        seoDescriptions: json(seoDescriptions),
        shortAnswers: json({}),
        emailSenderAddress: "no-reply@lastoria.md",
        cookieBannerEnabled: true,
      },
    });
  }
  console.log("Settings ready");

  /* ─────────── Группы товаров ─────────── */
  const categoryDefs: {
    slug: string;
    kind: "PIZZA" | "DRINK" | "ALCOHOL" | "OTHER";
    sortOrder: number;
    requiresAgeConfirm?: boolean;
    names: L10n;
    descriptions: L10n;
  }[] = [
    {
      slug: "pizza",
      kind: "PIZZA",
      sortOrder: 1,
      names: { ro: "Pizza", ru: "Пицца", en: "Pizza", it: "Pizza" },
      descriptions: {
        ro: "Pizza italiană pe aluat subțire, coaptă până la marginea rumenă.",
        ru: "Итальянская пицца на тонком тесте, выпеченная до румяного бортика.",
        en: "Italian thin-crust pizza baked to a golden crust.",
        it: "Pizza italiana a pasta sottile, cotta fino a un cornicione dorato.",
      },
    },
    {
      slug: "drinks",
      kind: "DRINK",
      sortOrder: 2,
      names: { ro: "Băuturi", ru: "Напитки", en: "Drinks", it: "Bevande" },
      descriptions: {
        ro: "Băuturi răcoritoare, apă și limonadă de casă.",
        ru: "Прохладительные напитки, вода и домашний лимонад.",
        en: "Soft drinks, water and homemade lemonade.",
        it: "Bibite, acqua e limonata fatta in casa.",
      },
    },
    {
      slug: "alcohol",
      kind: "ALCOHOL",
      sortOrder: 3,
      requiresAgeConfirm: true,
      names: { ro: "Alcool", ru: "Алкоголь", en: "Alcohol", it: "Alcolici" },
      descriptions: {
        ro: "Vin și bere — doar pentru persoane de 18+.",
        ru: "Вино и пиво — только для лиц 18+.",
        en: "Wine and beer — for persons 18+ only.",
        it: "Vino e birra — solo per maggiori di 18 anni.",
      },
    },
    {
      slug: "snacks",
      kind: "OTHER",
      sortOrder: 4,
      names: { ro: "Gustări și deserturi", ru: "Закуски и десерты", en: "Snacks and desserts", it: "Stuzzichini e dolci" },
      descriptions: {
        ro: "Gustări, sosuri și deserturi la pizza.",
        ru: "Закуски, соусы и десерты к пицце.",
        en: "Snacks, sauces and desserts to go with pizza.",
        it: "Stuzzichini, salse e dolci da abbinare alla pizza.",
      },
    },
  ];

  const categories: Record<string, { id: string }> = {};
  for (const def of categoryDefs) {
    const category = await prisma.category.upsert({
      where: { slug: def.slug },
      update: { isSystem: true },
      create: {
        slug: def.slug,
        kind: def.kind,
        sortOrder: def.sortOrder,
        isActive: true,
        isSystem: true,
        requiresAgeConfirm: def.requiresAgeConfirm ?? false,
      },
    });
    categories[def.slug] = category;
    await prisma.categoryTranslation.createMany({
      skipDuplicates: true,
      data: LOCALES.map((locale) => ({
        categoryId: category.id,
        locale,
        name: def.names[locale],
        description: def.descriptions[locale],
        seoTitle: `${def.names[locale]} — La Storia`,
        seoDescription: def.descriptions[locale],
      })),
    });
  }
  console.log("Categories ready");

  /* ─────────── Товары ─────────── */
  type ProductSeed = {
    slug: string;
    categorySlug: string;
    price: number;
    isAlcohol?: boolean;
    isVegetarian?: boolean;
    isSpicy?: boolean;
    isFeatured?: boolean;
    name: L10n;
    short: L10n;
    description: L10n;
    ingredients?: L10n;
    variants?: { key: string; priceDelta: number; names: L10n }[];
  };

  const SIZE_VARIANTS = (delta: number) => [
    { key: "25cm", priceDelta: 0, names: { ro: "25 cm", ru: "25 см", en: "25 cm", it: "25 cm" } },
    { key: "35cm", priceDelta: delta, names: { ro: "35 cm", ru: "35 см", en: "35 cm", it: "35 cm" } },
  ];

  const productDefs: ProductSeed[] = [
    {
      slug: "pizza-margarita",
      categorySlug: "pizza",
      price: 89,
      isVegetarian: true,
      isFeatured: true,
      name: { ro: "Margherita", ru: "Маргарита", en: "Margherita", it: "Margherita" },
      short: {
        ro: "Pizza clasică cu sos de roșii, mozzarella și busuioc.",
        ru: "Классическая пицца с томатным соусом, моцареллой и базиликом.",
        en: "Classic pizza with tomato sauce, mozzarella and basil.",
        it: "La pizza classica con pomodoro, mozzarella e basilico.",
      },
      description: {
        ro: "Clasicul bucătăriei italiene: sos de roșii, mozzarella și busuioc aromat pe aluat subțire.",
        ru: "Классика итальянской кухни: томатный соус, моцарелла и ароматный базилик на тонком тесте.",
        en: "An Italian classic: tomato sauce, mozzarella and fragrant basil on a thin crust.",
        it: "Un classico della cucina italiana: pomodoro, mozzarella e basilico profumato su pasta sottile.",
      },
      ingredients: {
        ro: "sos de roșii, mozzarella, busuioc, ulei de măsline",
        ru: "томатный соус, моцарелла, базилик, оливковое масло",
        en: "tomato sauce, mozzarella, basil, olive oil",
        it: "salsa di pomodoro, mozzarella, basilico, olio d'oliva",
      },
      variants: SIZE_VARIANTS(45),
    },
    {
      slug: "pizza-pepperoni",
      categorySlug: "pizza",
      price: 109,
      isSpicy: true,
      isFeatured: true,
      name: { ro: "Pepperoni", ru: "Пепперони", en: "Pepperoni", it: "Pepperoni" },
      short: {
        ro: "Pizza picantă cu salam pepperoni și mozzarella.",
        ru: "Острая пицца с колбасой пепперони и моцареллой.",
        en: "Spicy pizza with pepperoni sausage and mozzarella.",
        it: "Pizza piccante con salame pepperoni e mozzarella.",
      },
      description: {
        ro: "Aluat crocant, salam pepperoni picant, multă mozzarella și sos de roșii.",
        ru: "Хрустящее тесто, острая пепперони, много моцареллы и томатный соус.",
        en: "Crispy dough, spicy pepperoni, plenty of mozzarella and tomato sauce.",
        it: "Impasto croccante, pepperoni piccante, tanta mozzarella e salsa di pomodoro.",
      },
      ingredients: {
        ro: "sos de roșii, mozzarella, pepperoni",
        ru: "томатный соус, моцарелла, пепперони",
        en: "tomato sauce, mozzarella, pepperoni",
        it: "salsa di pomodoro, mozzarella, pepperoni",
      },
      variants: SIZE_VARIANTS(50),
    },
    {
      slug: "pizza-diavola",
      categorySlug: "pizza",
      price: 115,
      isSpicy: true,
      name: { ro: "Diavola", ru: "Дьявола", en: "Diavola", it: "Diavola" },
      short: {
        ro: "Pizza iute cu salam picant și ardei chili.",
        ru: "Огненная пицца с острой салями и перцем чили.",
        en: "Fiery pizza with spicy salami and chili pepper.",
        it: "Pizza infuocata con salame piccante e peperoncino.",
      },
      description: {
        ro: "Pentru cei care iubesc picantul: salam picant, ardei chili, mozzarella și sos de roșii.",
        ru: "Для любителей острого: острая салями, перец чили, моцарелла и томатный соус.",
        en: "For those who like it hot: spicy salami, chili, mozzarella and tomato sauce.",
        it: "Per chi ama il piccante: salame piccante, peperoncino, mozzarella e pomodoro.",
      },
      ingredients: {
        ro: "sos de roșii, mozzarella, salam picant, ardei chili",
        ru: "томатный соус, моцарелла, острая салями, перец чили",
        en: "tomato sauce, mozzarella, spicy salami, chili pepper",
        it: "salsa di pomodoro, mozzarella, salame piccante, peperoncino",
      },
    },
    {
      slug: "pizza-4-syra",
      categorySlug: "pizza",
      price: 125,
      isVegetarian: true,
      name: { ro: "Patru brânzeturi", ru: "Четыре сыра", en: "Four cheeses", it: "Quattro formaggi" },
      short: {
        ro: "Pizza cu patru feluri de brânză.",
        ru: "Нежная пицца с четырьмя видами сыра.",
        en: "Pizza with four kinds of cheese.",
        it: "Pizza con quattro tipi di formaggio.",
      },
      description: {
        ro: "Mozzarella, gorgonzola, parmezan și cheddar — gust bogat de brânză în fiecare felie.",
        ru: "Моцарелла, горгонзола, пармезан и чеддер — насыщенный сырный вкус.",
        en: "Mozzarella, gorgonzola, parmesan and cheddar — rich cheesy flavour in every slice.",
        it: "Mozzarella, gorgonzola, parmigiano e cheddar — sapore intenso in ogni fetta.",
      },
      ingredients: {
        ro: "mozzarella, gorgonzola, parmezan, cheddar",
        ru: "моцарелла, горгонзола, пармезан, чеддер",
        en: "mozzarella, gorgonzola, parmesan, cheddar",
        it: "mozzarella, gorgonzola, parmigiano, cheddar",
      },
    },
    {
      slug: "napitok-cola-0-5",
      categorySlug: "drinks",
      price: 25,
      name: { ro: "Coca-Cola 0,5 l", ru: "Coca-Cola 0,5 л", en: "Coca-Cola 0.5 l", it: "Coca-Cola 0,5 l" },
      short: {
        ro: "Băutură răcoritoare, 0,5 litri.",
        ru: "Освежающий напиток, 0,5 литра.",
        en: "Refreshing soft drink, 0.5 litres.",
        it: "Bibita rinfrescante, 0,5 litri.",
      },
      description: {
        ro: "Coca-Cola clasică la sticlă de 0,5 litri.",
        ru: "Классическая Coca-Cola в бутылке 0,5 литра.",
        en: "Classic Coca-Cola in a 0.5 litre bottle.",
        it: "Coca-Cola classica in bottiglia da 0,5 litri.",
      },
    },
    {
      slug: "voda-negazirovannaya",
      categorySlug: "drinks",
      price: 15,
      name: { ro: "Apă plată 0,5 l", ru: "Вода негазированная 0,5 л", en: "Still water 0.5 l", it: "Acqua naturale 0,5 l" },
      short: {
        ro: "Apă potabilă necarbogazoasă, 0,5 litri.",
        ru: "Питьевая вода без газа, 0,5 литра.",
        en: "Still drinking water, 0.5 litres.",
        it: "Acqua naturale, 0,5 litri.",
      },
      description: {
        ro: "Apă potabilă curată, fără gaz, 0,5 litri.",
        ru: "Чистая питьевая вода без газа, 0,5 литра.",
        en: "Clean still drinking water, 0.5 litres.",
        it: "Acqua potabile naturale, 0,5 litri.",
      },
    },
    {
      slug: "limonad-domashniy",
      categorySlug: "drinks",
      price: 30,
      isFeatured: true,
      name: { ro: "Limonadă de casă 0,5 l", ru: "Лимонад домашний 0,5 л", en: "Homemade lemonade 0.5 l", it: "Limonata fatta in casa 0,5 l" },
      short: {
        ro: "Limonadă de casă cu mentă și lămâie.",
        ru: "Домашний лимонад с мятой и лимоном.",
        en: "Homemade lemonade with mint and lemon.",
        it: "Limonata fatta in casa con menta e limone.",
      },
      description: {
        ro: "Limonadă răcoritoare din lămâie proaspătă și mentă.",
        ru: "Освежающий лимонад из свежего лимона и мяты.",
        en: "Refreshing lemonade made from fresh lemon and mint.",
        it: "Limonata rinfrescante con limone fresco e menta.",
      },
      ingredients: {
        ro: "lămâie, mentă, apă, zahăr",
        ru: "лимон, мята, вода, сахар",
        en: "lemon, mint, water, sugar",
        it: "limone, menta, acqua, zucchero",
      },
    },
    {
      slug: "vino-krasnoe-suhoe",
      categorySlug: "alcohol",
      price: 180,
      isAlcohol: true,
      name: { ro: "Vin roșu sec 0,75 l", ru: "Вино красное сухое 0,75 л", en: "Dry red wine 0.75 l", it: "Vino rosso secco 0,75 l" },
      short: {
        ro: "Vin roșu sec moldovenesc, sticlă de 0,75 l.",
        ru: "Молдавское сухое красное вино, бутылка 0,75 л.",
        en: "Moldovan dry red wine, 0.75 l bottle.",
        it: "Vino rosso secco moldavo, bottiglia da 0,75 l.",
      },
      description: {
        ro: "Vin roșu sec din Moldova, se potrivește perfect cu pizza.",
        ru: "Сухое красное вино молдавского производства, прекрасно сочетается с пиццей.",
        en: "Dry red wine from Moldova, a great match for pizza.",
        it: "Vino rosso secco della Moldova, perfetto con la pizza.",
      },
    },
    {
      slug: "pivo-svetloe",
      categorySlug: "alcohol",
      price: 35,
      isAlcohol: true,
      name: { ro: "Bere blondă 0,5 l", ru: "Пиво светлое 0,5 л", en: "Lager beer 0.5 l", it: "Birra chiara 0,5 l" },
      short: {
        ro: "Bere blondă, 0,5 litri.",
        ru: "Светлое пиво, 0,5 литра.",
        en: "Lager beer, 0.5 litres.",
        it: "Birra chiara, 0,5 litri.",
      },
      description: {
        ro: "Bere blondă răcoritoare la sticlă de 0,5 litri.",
        ru: "Освежающее светлое пиво в бутылке 0,5 литра.",
        en: "Refreshing lager in a 0.5 litre bottle.",
        it: "Birra chiara rinfrescante in bottiglia da 0,5 litri.",
      },
    },
    {
      slug: "chesnochnye-grenki",
      categorySlug: "snacks",
      price: 35,
      isVegetarian: true,
      name: { ro: "Crutoane cu usturoi", ru: "Чесночные гренки", en: "Garlic croutons", it: "Crostini all'aglio" },
      short: {
        ro: "Crutoane crocante cu usturoi și ierburi.",
        ru: "Хрустящие гренки с чесноком и травами.",
        en: "Crispy croutons with garlic and herbs.",
        it: "Crostini croccanti con aglio ed erbe.",
      },
      description: {
        ro: "Crutoane crocante coapte cu usturoi, ulei de măsline și ierburi.",
        ru: "Хрустящие гренки, запечённые с чесноком, оливковым маслом и травами.",
        en: "Crispy croutons baked with garlic, olive oil and herbs.",
        it: "Crostini croccanti cotti con aglio, olio d'oliva ed erbe.",
      },
    },
    {
      slug: "sous-chesnochnyy",
      categorySlug: "snacks",
      price: 12,
      isVegetarian: true,
      name: { ro: "Sos de usturoi", ru: "Соус чесночный", en: "Garlic sauce", it: "Salsa all'aglio" },
      short: {
        ro: "Sos cremos de usturoi pentru margini de pizza.",
        ru: "Сливочный чесночный соус для бортиков пиццы.",
        en: "Creamy garlic sauce for pizza crusts.",
        it: "Salsa cremosa all'aglio per il cornicione.",
      },
      description: {
        ro: "Sos cremos de usturoi — ideal pentru marginile de pizza.",
        ru: "Сливочный чесночный соус — идеален для бортиков пиццы.",
        en: "Creamy garlic sauce — perfect for pizza crusts.",
        it: "Salsa cremosa all'aglio — perfetta per il cornicione.",
      },
    },
    {
      slug: "tiramisu",
      categorySlug: "snacks",
      price: 60,
      isVegetarian: true,
      isFeatured: true,
      name: { ro: "Tiramisu", ru: "Тирамису", en: "Tiramisu", it: "Tiramisù" },
      short: {
        ro: "Desertul italian clasic tiramisu.",
        ru: "Классический итальянский десерт тирамису.",
        en: "The classic Italian dessert tiramisu.",
        it: "Il classico dolce italiano.",
      },
      description: {
        ro: "Desert delicat din mascarpone, cafea și pișcoturi savoiardi cu cacao.",
        ru: "Нежный десерт из маскарпоне, кофе и печенья савоярди с какао.",
        en: "A delicate dessert of mascarpone, coffee and savoiardi biscuits with cocoa.",
        it: "Dolce delicato con mascarpone, caffè, savoiardi e cacao.",
      },
      ingredients: {
        ro: "mascarpone, savoiardi, cafea, cacao",
        ru: "маскарпоне, савоярди, кофе, какао",
        en: "mascarpone, savoiardi, coffee, cocoa",
        it: "mascarpone, savoiardi, caffè, cacao",
      },
    },
  ];

  const products: Record<string, Awaited<ReturnType<typeof prisma.product.upsert>>> = {};
  for (const [index, def] of productDefs.entries()) {
    const imageUrl = await generatePlaceholder(def.slug, def.name.ro);
    const product = await prisma.product.upsert({
      where: { slug: def.slug },
      update: {},
      create: {
        slug: def.slug,
        categoryId: categories[def.categorySlug].id,
        price: def.price,
        isAlcohol: def.isAlcohol ?? false,
        isVegetarian: def.isVegetarian ?? false,
        isSpicy: def.isSpicy ?? false,
        isActive: true,
        isFeatured: def.isFeatured ?? false,
        sku: `LS-${(index + 1).toString().padStart(3, "0")}`,
        sortOrder: index,
        imageUrl,
        galleryUrls: json([imageUrl]),
        variants: json(def.variants ?? []),
      },
    });
    products[def.slug] = product;

    // Варианты из старой версии (ключ v1, v2 и название только по-русски) → дополняем языками
    if (def.variants) {
      const current = Array.isArray(product.variants) ? (product.variants as { key?: string; names?: Partial<L10n> }[]) : [];
      const needsUpgrade = current.length === def.variants.length && current.some((v) => !v.names?.ro);
      if (needsUpgrade) {
        await prisma.product.update({ where: { id: product.id }, data: { variants: json(def.variants) } });
      }
    }

    await prisma.productTranslation.createMany({
      skipDuplicates: true,
      data: LOCALES.map((locale) => ({
        productId: product.id,
        locale,
        name: def.name[locale],
        shortDescription: def.short[locale],
        description: def.description[locale],
        ingredientsText: def.ingredients?.[locale] ?? null,
        seoTitle: `${def.name[locale]} — La Storia`,
        seoDescription: def.short[locale],
        imageAlt: def.name[locale],
      })),
    });
  }
  console.log(`Products ready: ${Object.keys(products).length}`);

  /* ─────────── Промо ─────────── */
  const now = new Date();
  const in30days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const minus7days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const diavolaNames: L10n = {
    ro: "Diavola −15%",
    ru: "Дьявола −15%",
    en: "Diavola −15%",
    it: "Diavola −15%",
  };
  const autoPromo = await prisma.promo.findFirst({ where: { name: "Автоматическая скидка на Дьяволу" } });
  if (!autoPromo) {
    await prisma.promo.create({
      data: {
        name: "Автоматическая скидка на Дьяволу",
        publicNames: json(diavolaNames),
        type: "PERCENT",
        value: 15,
        scope: "PRODUCT",
        targetIds: json([products["pizza-diavola"].id]),
        startsAt: minus7days,
        endsAt: in30days,
        isActive: true,
        stackable: false,
      },
    });
  }

  const drinkNames: L10n = {
    ro: "Cod DRINKS10: −10% la băuturi",
    ru: "Промокод DRINKS10: −10% на напитки",
    en: "Code DRINKS10: −10% on drinks",
    it: "Codice DRINKS10: −10% sulle bevande",
  };
  const drinks = await prisma.promo.upsert({
    where: { code: "DRINKS10" },
    update: {},
    create: {
      name: "Скидка 10% на все напитки по промокоду",
      publicNames: json(drinkNames),
      code: "DRINKS10",
      type: "PERCENT",
      value: 10,
      scope: "CATEGORY",
      targetIds: json([categories["drinks"].id]),
      startsAt: minus7days,
      endsAt: in30days,
      isActive: true,
      stackable: true,
    },
  });
  await prisma.promo.update({ where: { id: drinks.id }, data: { publicNames: json(fillMap(drinks.publicNames, drinkNames)) } });

  const oldDiavola = await prisma.promo.findUnique({ where: { code: "DIAVOLA15" } });
  if (oldDiavola) {
    await prisma.promo.update({
      where: { id: oldDiavola.id },
      data: { publicNames: json(fillMap(oldDiavola.publicNames, diavolaNames)) },
    });
  }
  console.log("Promos ready");

  /* ─────────── Доставка: Кишинёв и районы ─────────── */
  const city = await prisma.deliveryCity.upsert({
    where: { slug: "chisinau" },
    update: {},
    create: {
      slug: "chisinau",
      names: json({ ro: "Chișinău", ru: "Кишинёв", en: "Chișinău", it: "Chișinău" }),
      sortOrder: 1,
    },
  });
  await prisma.deliveryCity.update({
    where: { id: city.id },
    data: { names: json(fillMap(city.names, { ro: "Chișinău", ru: "Кишинёв", en: "Chișinău", it: "Chișinău" })) },
  });

  // ПЛЕЙСХОЛДЕРЫ стоимости — реальные цены задаются в админке: Доставка
  const districts: { names: L10n; fee: number }[] = [
    { names: { ro: "Centru", ru: "Центр", en: "Centru (city centre)", it: "Centru (centro)" }, fee: 50 },
    { names: { ro: "Botanica", ru: "Ботаника", en: "Botanica", it: "Botanica" }, fee: 50 },
    { names: { ro: "Buiucani", ru: "Буюканы", en: "Buiucani", it: "Buiucani" }, fee: 50 },
    { names: { ro: "Rîșcani", ru: "Рышкановка", en: "Rîșcani", it: "Rîșcani" }, fee: 50 },
    { names: { ro: "Ciocana", ru: "Чеканы", en: "Ciocana", it: "Ciocana" }, fee: 50 },
    { names: { ro: "Poșta Veche", ru: "Старая Почта", en: "Poșta Veche", it: "Poșta Veche" }, fee: 50 },
    { names: { ro: "Telecentru", ru: "Телецентр", en: "Telecentru", it: "Telecentru" }, fee: 50 },
  ];
  const zones = await prisma.deliveryZone.findMany({ where: { cityId: city.id } });
  // Районы из старой версии (только русское название, без румынского) — скрываем,
  // вместо них заводятся районы Кишинёва. Включить обратно можно в админке.
  const legacy = zones.filter((z) => !(z.names as Partial<L10n>)?.ro);
  for (const [index, zone] of legacy.entries()) {
    if (zone.isActive || zone.sortOrder < 1000) {
      await prisma.deliveryZone.update({ where: { id: zone.id }, data: { isActive: false, sortOrder: 1000 + index } });
    }
  }
  for (const [index, district] of districts.entries()) {
    const exists = zones.some((z) => (z.names as Partial<L10n>)?.ro === district.names.ro);
    if (!exists) {
      await prisma.deliveryZone.create({
        data: { cityId: city.id, names: json(district.names), fee: district.fee, sortOrder: index + 1 },
      });
    }
  }
  console.log("Delivery zones ready");

  /* ─────────── Демо-заказы (только в пустой базе) ─────────── */
  if ((await prisma.order.count()) === 0) {
    const daysAgo = (n: number) => new Date(now.getTime() - n * 24 * 60 * 60 * 1000);
    const demoOrders: {
      status: "PENDING_CONFIRMATION" | "CONFIRMED" | "PREPARING" | "COMPLETED" | "CANCELLED";
      createdAt: Date;
      locale: AppLocale;
      fulfillment: "DELIVERY" | "PICKUP";
      customerName: string;
      phone: string;
      email?: string;
      address?: string;
      zone?: string;
      items: { slug: string; qty: number }[];
    }[] = [
      {
        status: "PENDING_CONFIRMATION",
        createdAt: daysAgo(0),
        locale: "ro",
        fulfillment: "DELIVERY",
        customerName: "Ion Moraru",
        phone: "+37369112233",
        email: "ion.moraru@example.com",
        address: "str. Alba Iulia 12",
        zone: "Buiucani",
        items: [
          { slug: "pizza-margarita", qty: 1 },
          { slug: "napitok-cola-0-5", qty: 2 },
        ],
      },
      {
        status: "CONFIRMED",
        createdAt: daysAgo(1),
        locale: "ru",
        fulfillment: "PICKUP",
        customerName: "Мария Попеску",
        phone: "+37369223344",
        items: [
          { slug: "pizza-pepperoni", qty: 1 },
          { slug: "sous-chesnochnyy", qty: 1 },
        ],
      },
      {
        status: "PREPARING",
        createdAt: daysAgo(2),
        locale: "en",
        fulfillment: "DELIVERY",
        customerName: "Andrei Rusu",
        phone: "+37378334455",
        address: "str. Ismail 45",
        zone: "Centru",
        items: [
          { slug: "pizza-diavola", qty: 2 },
          { slug: "pivo-svetloe", qty: 2 },
        ],
      },
      {
        status: "COMPLETED",
        createdAt: daysAgo(5),
        locale: "it",
        fulfillment: "DELIVERY",
        customerName: "Elena Cojocaru",
        phone: "+37360445566",
        email: "elena.k@example.com",
        address: "bd. Renașterii 8",
        zone: "Rîșcani",
        items: [
          { slug: "pizza-4-syra", qty: 1 },
          { slug: "tiramisu", qty: 2 },
        ],
      },
      {
        status: "CANCELLED",
        createdAt: daysAgo(20),
        locale: "ru",
        fulfillment: "PICKUP",
        customerName: "Виктор Гуцу",
        phone: "+37377756677",
        items: [{ slug: "pizza-margarita", qty: 3 }],
      },
    ];

    const zoneRows = await prisma.deliveryZone.findMany({ where: { cityId: city.id, isActive: true } });
    for (const demo of demoOrders) {
      const translations = await prisma.productTranslation.findMany({
        where: { productId: { in: demo.items.map((i) => products[i.slug].id) }, locale: demo.locale },
      });
      const lineItems = demo.items.map((it) => {
        const product = products[it.slug];
        const unitPrice = toNumber(product.price);
        return {
          productId: product.id,
          nameSnapshot: translations.find((t) => t.productId === product.id)?.name ?? product.slug,
          qty: it.qty,
          unitPrice,
          lineTotal: unitPrice * it.qty,
        };
      });
      const zone = demo.zone ? zoneRows.find((z) => (z.names as Partial<L10n>).ro === demo.zone) : undefined;
      const subtotal = lineItems.reduce((s, i) => s + i.lineTotal, 0);
      const deliveryFee = demo.fulfillment === "DELIVERY" ? toNumber(zone?.fee ?? 0) : 0;
      await prisma.order.create({
        data: {
          status: demo.status,
          locale: demo.locale,
          fulfillment: demo.fulfillment,
          paymentMethod: "CASH",
          customerName: demo.customerName,
          phone: demo.phone,
          email: demo.email,
          address: demo.address,
          deliveryZoneId: zone?.id,
          deliveryCityName: zone ? "Кишинёв" : null,
          deliveryZoneName: zone ? (zone.names as Partial<L10n>).ru : null,
          ageConfirmed: demo.items.some((i) => i.slug === "pivo-svetloe"),
          subtotal,
          deliveryFee,
          total: subtotal + deliveryFee,
          appliedPromos: json([]),
          createdAt: demo.createdAt,
          confirmedAt: demo.status === "PENDING_CONFIRMATION" ? null : demo.createdAt,
          cancelledAt: demo.status === "CANCELLED" ? demo.createdAt : null,
          items: { create: lineItems },
          events: {
            create: [
              { fromStatus: null, toStatus: "PENDING_CONFIRMATION", actor: "CUSTOMER", createdAt: demo.createdAt },
              ...(demo.status !== "PENDING_CONFIRMATION"
                ? [
                    {
                      fromStatus: "PENDING_CONFIRMATION" as const,
                      toStatus: demo.status === "CANCELLED" ? ("CANCELLED" as const) : ("CONFIRMED" as const),
                      actor: "ADMIN" as const,
                      createdAt: demo.createdAt,
                    },
                  ]
                : []),
            ],
          },
        },
      });
    }
    console.log(`Demo orders created: ${demoOrders.length}`);
  }

  console.log("Seed complete");
}

main()
  .catch((error) => {
    console.error(error);
    if (error && typeof error === "object" && "code" in error && (error.code === "P2022" || error.code === "P2021")) {
      console.error(
        "\nСтруктура базы и клиент Prisma не совпадают. Выполните по порядку:\n" +
          "  npx prisma generate\n  npx prisma migrate deploy\n  npm run db:seed\n" +
          "или всё сразу: bash scripts/aapanel-update.sh (см. README, шаг 6)."
      );
    }
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
