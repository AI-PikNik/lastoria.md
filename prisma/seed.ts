import "dotenv/config";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/format";
import { generatePlaceholder } from "./seed-placeholders";

async function main() {
  console.log("Seeding database…");

  // --- Admin user ---
  const adminEmail = process.env.ADMIN_EMAIL ?? "admin@lastoria.md";
  const adminPassword = process.env.ADMIN_PASSWORD ?? "admin12345";
  const adminName = process.env.ADMIN_NAME ?? "Admin";
  const passwordHash = await bcrypt.hash(adminPassword, 10);

  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      name: adminName,
      passwordHash,
      role: "ADMIN",
    },
  });
  console.log(`Admin user ready: ${adminEmail}`);

  // --- Settings ---
  await prisma.settings.upsert({
    where: { id: "main" },
    update: {},
    create: {
      id: "main",
      restaurantName: "La Storia",
      restaurantPhone: "+373 22 000 000",
      restaurantAddress: "str. Ștefan cel Mare 1, Chișinău, Republica Moldova",
      restaurantEmail: "hello@lastoria.md",
      workingHours: "10:00–22:00, ежедневно",
      minOrderAmount: 100,
      deliveryZones: [
        { name: "Центр", fee: 25 },
        { name: "Ботаника / Рышкановка", fee: 40 },
        { name: "Остальной город", fee: 60 },
      ],
      seoDefaultTitle: "La Storia — настоящая пиццерия в Кишинёве",
      seoDefaultDescription:
        "Пицца на дровах, напитки и десерты с доставкой по Кишинёву или самовывозом. Закажите онлайн за минуту.",
      telegramChatId: null,
      emailSenderAddress: "no-reply@lastoria.md",
    },
  });
  console.log("Settings ready");

  // --- Categories ---
  const categoryDefs = [
    { name: "Пицца", slug: "pizza", sortOrder: 1 },
    { name: "Напитки", slug: "drinks", sortOrder: 2 },
    { name: "Алкоголь", slug: "alcohol", sortOrder: 3 },
    { name: "Снеки", slug: "snacks", sortOrder: 4 },
  ];

  const categories: Record<string, Awaited<ReturnType<typeof prisma.category.upsert>>> = {};
  for (const def of categoryDefs) {
    categories[def.slug] = await prisma.category.upsert({
      where: { slug: def.slug },
      update: {},
      create: {
        name: def.name,
        slug: def.slug,
        sortOrder: def.sortOrder,
        isActive: true,
        seoTitle: `${def.name} — La Storia`,
        seoDescription: `${def.name} в меню La Storia: закажите онлайн с доставкой по Кишинёву или заберите сами.`,
      },
    });
  }
  console.log("Categories ready");

  // --- Products ---
  type ProductSeed = {
    name: string;
    slug: string;
    categorySlug: string;
    type: "PIZZA" | "DRINK" | "ALCOHOL" | "OTHER";
    price: number;
    oldPrice?: number;
    isAlcohol?: boolean;
    isVegetarian?: boolean;
    isSpicy?: boolean;
    isFeatured?: boolean;
    shortDescription: string;
    description: string;
    ingredients: string[];
    variants?: { name: string; priceDelta: number }[];
  };

  const productDefs: ProductSeed[] = [
    {
      name: "Маргарита",
      slug: "pizza-margarita",
      categorySlug: "pizza",
      type: "PIZZA",
      price: 89,
      isVegetarian: true,
      isFeatured: true,
      shortDescription: "Классическая пицца с томатным соусом, моцареллой и базиликом.",
      description:
        "Классика итальянской кухни: свежий томатный соус, моцарелла и ароматный базилик на тонком тесте, выпеченном в дровяной печи.",
      ingredients: ["томатный соус", "моцарелла", "базилик", "оливковое масло"],
      variants: [
        { name: "25 см", priceDelta: 0 },
        { name: "35 см", priceDelta: 45 },
      ],
    },
    {
      name: "Пепперони",
      slug: "pizza-pepperoni",
      categorySlug: "pizza",
      type: "PIZZA",
      price: 109,
      isSpicy: true,
      isFeatured: true,
      shortDescription: "Острая пицца с пикантной колбасой пепперони и моцареллой.",
      description:
        "Хрустящее тесто, острая колбаса пепперони, много моцареллы и фирменный томатный соус.",
      ingredients: ["томатный соус", "моцарелла", "пепперони"],
      variants: [
        { name: "25 см", priceDelta: 0 },
        { name: "35 см", priceDelta: 50 },
      ],
    },
    {
      name: "Дьябло",
      slug: "pizza-diavola",
      categorySlug: "pizza",
      type: "PIZZA",
      price: 115,
      isSpicy: true,
      shortDescription: "Огненная пицца с острой салями и перцем чили.",
      description:
        "Для тех, кто любит поострее: острая салями, перец чили, моцарелла и томатный соус.",
      ingredients: ["томатный соус", "моцарелла", "острая салями", "перец чили"],
    },
    {
      name: "Четыре сыра",
      slug: "pizza-4-syra",
      categorySlug: "pizza",
      type: "PIZZA",
      price: 125,
      isVegetarian: true,
      shortDescription: "Нежная пицца с четырьмя видами сыра.",
      description:
        "Моцарелла, горгонзола, пармезан и чеддер — насыщенный сырный вкус в каждом кусочке.",
      ingredients: ["моцарелла", "горгонзола", "пармезан", "чеддер"],
    },
    {
      name: "Coca-Cola 0.5л",
      slug: "napitok-cola-0-5",
      categorySlug: "drinks",
      type: "DRINK",
      price: 25,
      shortDescription: "Освежающий напиток, 0.5 литра.",
      description: "Классическая Coca-Cola в бутылке 0.5 литра.",
      ingredients: [],
    },
    {
      name: "Вода негазированная 0.5л",
      slug: "voda-negazirovannaya",
      categorySlug: "drinks",
      type: "DRINK",
      price: 15,
      shortDescription: "Питьевая негазированная вода, 0.5 литра.",
      description: "Чистая питьевая вода без газа, 0.5 литра.",
      ingredients: [],
    },
    {
      name: "Лимонад домашний 0.5л",
      slug: "limonad-domashniy",
      categorySlug: "drinks",
      type: "DRINK",
      price: 30,
      isFeatured: true,
      shortDescription: "Домашний лимонад с мятой и лимоном.",
      description: "Освежающий домашний лимонад на основе свежего лимона и мяты.",
      ingredients: ["лимон", "мята", "вода", "сахар"],
    },
    {
      name: "Вино красное сухое 0.75л",
      slug: "vino-krasnoe-suhoe",
      categorySlug: "alcohol",
      type: "ALCOHOL",
      price: 180,
      isAlcohol: true,
      shortDescription: "Молдавское сухое красное вино, бутылка 0.75 л.",
      description: "Сухое красное вино молдавского производства, прекрасно сочетается с пиццей.",
      ingredients: [],
    },
    {
      name: "Пиво светлое 0.5л",
      slug: "pivo-svetloe",
      categorySlug: "alcohol",
      type: "ALCOHOL",
      price: 45,
      isAlcohol: true,
      shortDescription: "Светлое лагерное пиво, 0.5 литра.",
      description: "Классическое светлое пиво лагерного типа, 0.5 литра.",
      ingredients: [],
    },
    {
      name: "Чесночные гренки",
      slug: "chesnochnye-grenki",
      categorySlug: "snacks",
      type: "OTHER",
      price: 45,
      isVegetarian: true,
      shortDescription: "Хрустящие гренки с чесноком и сыром.",
      description: "Хрустящие пшеничные гренки с чесночным маслом и сыром пармезан.",
      ingredients: ["хлеб", "чеснок", "пармезан", "оливковое масло"],
    },
    {
      name: "Соус чесночный",
      slug: "sous-chesnochnyy",
      categorySlug: "snacks",
      type: "OTHER",
      price: 20,
      isVegetarian: true,
      shortDescription: "Фирменный чесночный соус, 50 мл.",
      description: "Насыщенный чесночный соус собственного приготовления, 50 мл.",
      ingredients: ["чеснок", "сметана", "зелень"],
    },
    {
      name: "Тирамису",
      slug: "tiramisu",
      categorySlug: "snacks",
      type: "OTHER",
      price: 60,
      isVegetarian: true,
      isFeatured: true,
      shortDescription: "Классический итальянский десерт тирамису.",
      description: "Нежный десерт из маскарпоне, кофе и печенья савоярди с какао.",
      ingredients: ["маскарпоне", "савоярди", "кофе", "какао"],
    },
  ];

  const products: Record<string, Awaited<ReturnType<typeof prisma.product.upsert>>> = {};

  for (const [index, def] of productDefs.entries()) {
    const imageUrl = await generatePlaceholder(def.slug, def.name);
    products[def.slug] = await prisma.product.upsert({
      where: { slug: def.slug },
      update: {},
      create: {
        name: def.name,
        slug: def.slug,
        description: def.description,
        shortDescription: def.shortDescription,
        categoryId: categories[def.categorySlug].id,
        type: def.type,
        price: def.price,
        oldPrice: def.oldPrice ?? null,
        isAlcohol: def.isAlcohol ?? false,
        isVegetarian: def.isVegetarian ?? false,
        isSpicy: def.isSpicy ?? false,
        isActive: true,
        isFeatured: def.isFeatured ?? false,
        sku: `LS-${(index + 1).toString().padStart(3, "0")}`,
        sortOrder: index,
        stock: null,
        imageUrl,
        galleryUrls: [imageUrl],
        ingredients: def.ingredients,
        variants: def.variants ?? undefined,
        seoTitle: `${def.name} — заказать в La Storia`,
        seoDescription: def.shortDescription,
        seoKeywords: `${def.name}, La Storia, пицца Кишинёв`,
      },
    });
  }
  console.log(`Products ready: ${Object.keys(products).length}`);

  // --- Promos ---
  const now = new Date();
  const in30days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const minus7days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  await prisma.promo.upsert({
    where: { code: "DIAVOLA15" },
    update: {},
    create: {
      name: "Скидка 15% на пиццу Дьябло",
      code: "DIAVOLA15",
      type: "PERCENT",
      value: 15,
      scope: "PRODUCT",
      targetIds: [products["pizza-diavola"].id],
      startsAt: minus7days,
      endsAt: in30days,
      isActive: true,
      stackable: false,
    },
  });

  await prisma.promo.upsert({
    where: { code: "DRINKS10" },
    update: {},
    create: {
      name: "Скидка 10% на все напитки",
      code: "DRINKS10",
      type: "PERCENT",
      value: 10,
      scope: "CATEGORY",
      targetIds: [categories["drinks"].id],
      startsAt: minus7days,
      endsAt: in30days,
      isActive: true,
      stackable: true,
    },
  });
  console.log("Promos ready");

  // --- Demo orders ---
  const existingOrders = await prisma.order.count();
  if (existingOrders === 0) {
    const daysAgo = (n: number) => new Date(now.getTime() - n * 24 * 60 * 60 * 1000);

    type DemoOrder = {
      status:
        | "PENDING_CONFIRMATION"
        | "CONFIRMED"
        | "PREPARING"
        | "OUT_FOR_DELIVERY"
        | "READY_FOR_PICKUP"
        | "COMPLETED"
        | "CANCELLED";
      createdAt: Date;
      fulfillment: "DELIVERY" | "PICKUP";
      customerName: string;
      phone: string;
      email?: string;
      address?: string;
      items: { slug: string; qty: number }[];
    };

    const demoOrders: DemoOrder[] = [
      {
        status: "PENDING_CONFIRMATION",
        createdAt: daysAgo(0),
        fulfillment: "DELIVERY",
        customerName: "Ион Морару",
        phone: "+37369112233",
        email: "ion.moraru@example.com",
        address: "str. Alba Iulia 12, Chișinău",
        items: [
          { slug: "pizza-margarita", qty: 1 },
          { slug: "napitok-cola-0-5", qty: 2 },
        ],
      },
      {
        status: "CONFIRMED",
        createdAt: daysAgo(1),
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
        fulfillment: "DELIVERY",
        customerName: "Андрей Русу",
        phone: "+37369334455",
        address: "str. Ismail 45, Chișinău",
        items: [
          { slug: "pizza-diavola", qty: 2 },
          { slug: "pivo-svetloe", qty: 2 },
        ],
      },
      {
        status: "COMPLETED",
        createdAt: daysAgo(5),
        fulfillment: "DELIVERY",
        customerName: "Елена Кожокару",
        phone: "+37369445566",
        email: "elena.k@example.com",
        address: "str. Renasterii 8, Chișinău",
        items: [
          { slug: "pizza-4-syra", qty: 1 },
          { slug: "tiramisu", qty: 2 },
          { slug: "limonad-domashniy", qty: 2 },
        ],
      },
      {
        status: "COMPLETED",
        createdAt: daysAgo(20),
        fulfillment: "PICKUP",
        customerName: "Виктор Гуцу",
        phone: "+37369556677",
        items: [
          { slug: "pizza-margarita", qty: 3 },
          { slug: "vino-krasnoe-suhoe", qty: 1 },
        ],
      },
      {
        status: "CANCELLED",
        createdAt: daysAgo(35),
        fulfillment: "DELIVERY",
        customerName: "Наталья Флоря",
        phone: "+37369667788",
        address: "str. Independentei 3, Chișinău",
        items: [{ slug: "pizza-pepperoni", qty: 1 }],
      },
    ];

    for (const demo of demoOrders) {
      const lineItems = demo.items.map((it) => {
        const product = products[it.slug];
        const unitPrice = toNumber(product.price);
        return {
          productId: product.id,
          nameSnapshot: product.name,
          qty: it.qty,
          unitPrice,
          lineTotal: unitPrice * it.qty,
        };
      });
      const subtotal = lineItems.reduce((s, i) => s + i.lineTotal, 0);
      const deliveryFee = demo.fulfillment === "DELIVERY" ? 40 : 0;
      const discountTotal = 0;
      const total = subtotal + deliveryFee - discountTotal;

      const order = await prisma.order.create({
        data: {
          status: demo.status,
          fulfillment: demo.fulfillment,
          paymentMethod: "CASH",
          customerName: demo.customerName,
          phone: demo.phone,
          email: demo.email,
          address: demo.address,
          subtotal,
          discountTotal,
          deliveryFee,
          total,
          appliedPromos: [],
          createdAt: demo.createdAt,
          updatedAt: demo.createdAt,
          confirmedAt: demo.status === "PENDING_CONFIRMATION" ? null : demo.createdAt,
          cancelledAt: demo.status === "CANCELLED" ? demo.createdAt : null,
          items: { create: lineItems },
        },
      });

      const events: {
        fromStatus: DemoOrder["status"] | null;
        toStatus: DemoOrder["status"];
        actor: "CUSTOMER" | "ADMIN" | "SYSTEM";
        note?: string;
      }[] = [{ fromStatus: null, toStatus: "PENDING_CONFIRMATION", actor: "CUSTOMER" }];

      if (demo.status !== "PENDING_CONFIRMATION") {
        events.push({
          fromStatus: "PENDING_CONFIRMATION",
          toStatus: demo.status === "CANCELLED" ? "CANCELLED" : "CONFIRMED",
          actor: "ADMIN",
          note: demo.status === "CANCELLED" ? "Клиент отменил заказ" : "Заказ подтверждён оператором",
        });
      }

      await prisma.orderEvent.createMany({
        data: events.map((e) => ({
          orderId: order.id,
          fromStatus: e.fromStatus,
          toStatus: e.toStatus,
          actor: e.actor,
          note: e.note,
          createdAt: demo.createdAt,
        })),
      });
    }
    console.log(`Demo orders ready: ${demoOrders.length}`);
  } else {
    console.log("Orders already exist, skipping demo orders");
  }

  console.log("Seed complete.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
