/**
 * Описание редактируемых текстов страниц для раздела админки «Тексты страниц».
 * Каждое поле — ключ словаря messages/*.json; правки сохраняются в базе
 * (UiTranslation) поверх базового словаря, как и на странице «Переводы».
 */
export interface PageTextField {
  key: string;
  label: string;
  multiline?: boolean;
  hint?: string;
}

export interface PageTextGroup {
  id: string;
  title: string;
  /** Путь на сайте (без языка) — для ссылки «Открыть на сайте» */
  url: string;
  description: string;
  fields: PageTextField[];
}

const seo = (ns: string): PageTextField[] => [
  { key: `${ns}.title`, label: "Название во вкладке браузера и в Google (SEO-заголовок)" },
  { key: `${ns}.description`, label: "Описание для Google (SEO-описание, 70–160 символов)", multiline: true },
];

const PLACEHOLDER_HINT = "Слова в фигурных скобках, например {min} или {address}, не удаляйте — туда сайт подставляет данные из настроек.";

export const PAGE_TEXT_GROUPS: PageTextGroup[] = [
  {
    id: "home",
    title: "Главная",
    url: "/",
    description: "Подзаголовок, слоган, история ресторана и блоки «Доставка / Самовывоз / Оплата».",
    fields: [
      { key: "home.heroTitle", label: "Подзаголовок под названием ресторана" },
      { key: "meta.tagline", label: "Слоган (курсивом)" },
      { key: "meta.subtitle", label: "Подпись под логотипом" },
      { key: "home.storyTitle", label: "Заголовок блока «История»" },
      { key: "home.story.p1", label: "История — абзац 1", multiline: true },
      { key: "home.story.p2", label: "История — абзац 2", multiline: true },
      { key: "home.story.p3", label: "История — абзац 3", multiline: true },
      { key: "home.deliveryText", label: "Блок «Доставка»", multiline: true, hint: PLACEHOLDER_HINT },
      { key: "home.pickupText", label: "Блок «Самовывоз»", multiline: true },
      { key: "home.paymentText", label: "Блок «Оплата»", multiline: true },
    ],
  },
  {
    id: "about",
    title: "О нас",
    url: "/about",
    description:
      "Общий текст страницы «О нас». Ниже на странице — заведения с адресом, текстом о месте и галереей: их добавляют в разделе «Заведения». Пустой абзац не показывается.",
    fields: [
      { key: "pages.about.h1", label: "Заголовок на странице" },
      { key: "pages.about.body.p1", label: "Абзац 1", multiline: true },
      { key: "pages.about.body.p2", label: "Абзац 2", multiline: true },
      { key: "pages.about.body.p3", label: "Абзац 3 (курсивом)", multiline: true },
      { key: "pages.about.body.p4", label: "Абзац 4", multiline: true },
      { key: "pages.about.locationsTitle", label: "Заголовок блока с заведениями" },
      ...seo("pages.about"),
    ],
  },
  {
    id: "delivery",
    title: "Доставка и оплата",
    url: "/delivery",
    description:
      "Тексты страницы доставки. Районы и цены — в разделе «Доставка», вопросы-ответы внизу страницы — в разделе «Вопросы и ответы».",
    fields: [
      { key: "pages.delivery.h1", label: "Заголовок на странице" },
      { key: "pages.delivery.faqTitle", label: "Заголовок блока вопросов-ответов" },
      { key: "pages.delivery.paymentText", label: "Способы оплаты", multiline: true },
      { key: "pages.delivery.pickupText", label: "Самовывоз", multiline: true, hint: PLACEHOLDER_HINT },
      ...seo("pages.delivery"),
    ],
  },
  {
    id: "contacts",
    title: "Контакты",
    url: "/contacts",
    description: "Телефон, адрес, email и часы работы меняются в «Настройках». Здесь — только заголовки.",
    fields: [{ key: "pages.contacts.h1", label: "Заголовок на странице" }, ...seo("pages.contacts")],
  },
  {
    id: "privacy",
    title: "Политика конфиденциальности",
    url: "/privacy",
    description: "",
    fields: [
      { key: "pages.privacy.h1", label: "Заголовок на странице" },
      { key: "pages.privacy.body.p1", label: "Абзац 1", multiline: true },
      { key: "pages.privacy.body.p2", label: "Абзац 2", multiline: true },
      { key: "pages.privacy.body.p3", label: "Абзац 3", multiline: true },
      { key: "pages.privacy.body.p4", label: "Абзац 4", multiline: true },
      ...seo("pages.privacy"),
    ],
  },
  {
    id: "terms",
    title: "Условия (публичная оферта)",
    url: "/terms",
    description: "",
    fields: [
      { key: "pages.terms.h1", label: "Заголовок на странице" },
      { key: "pages.terms.body.p1", label: "Абзац 1", multiline: true },
      { key: "pages.terms.body.p2", label: "Абзац 2", multiline: true },
      { key: "pages.terms.body.p3", label: "Абзац 3", multiline: true },
      ...seo("pages.terms"),
    ],
  },
  {
    id: "age-policy",
    title: "Алкоголь 18+",
    url: "/age-policy",
    description: "",
    fields: [
      { key: "pages.agePolicy.h1", label: "Заголовок на странице" },
      { key: "pages.agePolicy.body.p1", label: "Абзац 1", multiline: true },
      { key: "pages.agePolicy.body.p2", label: "Абзац 2", multiline: true },
      { key: "ageGate.text", label: "Текст окна «Вам есть 18?»", multiline: true },
      ...seo("pages.agePolicy"),
    ],
  },
  {
    id: "cookies",
    title: "Политика cookies и баннер",
    url: "/cookies",
    description: "",
    fields: [
      { key: "pages.cookies.h1", label: "Заголовок на странице" },
      { key: "pages.cookies.body.p1", label: "Абзац 1", multiline: true },
      { key: "pages.cookies.body.p2", label: "Абзац 2", multiline: true },
      { key: "pages.cookies.body.p3", label: "Абзац 3", multiline: true },
      { key: "cookies.title", label: "Баннер: заголовок" },
      { key: "cookies.text", label: "Баннер: текст", multiline: true },
      ...seo("pages.cookies"),
    ],
  },
  {
    id: "footer",
    title: "Подвал сайта",
    url: "/",
    description: "Текст о ресторане внизу каждой страницы. Копирайт («© …») — в «Настройки → Подвал».",
    fields: [{ key: "footer.about", label: "Текст о ресторане", multiline: true }],
  },
];

export function findPageTextGroup(id: string) {
  return PAGE_TEXT_GROUPS.find((g) => g.id === id);
}
