import { beforeEach, describe, expect, it } from "vitest";
import {
  absoluteUrl,
  breadcrumbJsonLd,
  buildMetadata,
  countWords,
  faqJsonLd,
  hreflangAlternates,
  isShortAnswerLengthOk,
  plainText,
  productJsonLd,
} from "@/lib/seo";
import { slugify, transliterate } from "@/lib/slug";
import { productSeoChecklist } from "@/lib/seo-checklist";

describe("SEO: canonical и hreflang", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://lastoria.md";
  });

  it("румынская версия без префикса, остальные — /ru, /en, /it, x-default → ro", () => {
    expect(hreflangAlternates("/menu/pizza-margarita")).toEqual({
      ro: "https://lastoria.md/menu/pizza-margarita",
      ru: "https://lastoria.md/ru/menu/pizza-margarita",
      en: "https://lastoria.md/en/menu/pizza-margarita",
      it: "https://lastoria.md/it/menu/pizza-margarita",
      "x-default": "https://lastoria.md/menu/pizza-margarita",
    });
  });

  it("главная: /, /ru, /en, /it", () => {
    const alt = hreflangAlternates("/");
    expect(alt.ro).toBe("https://lastoria.md/");
    expect(alt.ru).toBe("https://lastoria.md/ru");
  });

  it("canonical указывает на версию текущего языка, og:locale — на её регион", () => {
    const metadata = buildMetadata({ locale: "ru", path: "/menu", title: "Меню", description: "Меню" });
    expect(metadata.alternates?.canonical).toBe("https://lastoria.md/ru/menu");
    expect(metadata.openGraph).toMatchObject({ locale: "ru_RU", url: "https://lastoria.md/ru/menu" });
    expect((metadata.openGraph as { alternateLocale: string[] }).alternateLocale).toEqual(["ro_RO", "en_US", "it_IT"]);
    expect(metadata.alternates?.languages).toMatchObject({ "x-default": "https://lastoria.md/menu" });
  });

  it("noindex-страницы без canonical/hreflang", () => {
    const metadata = buildMetadata({ locale: "ro", path: "/cart", title: "Coș", description: "", noIndex: true });
    expect(metadata.robots).toEqual({ index: false, follow: false });
    expect(metadata.alternates).toBeUndefined();
  });

  it("absoluteUrl всегда с ведущим слэшем и не трогает абсолютные ссылки", () => {
    expect(absoluteUrl("menu")).toBe("https://lastoria.md/menu");
    expect(absoluteUrl("https://cdn.example.com/a.jpg")).toBe("https://cdn.example.com/a.jpg");
  });
});

describe("SEO: JSON-LD", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://lastoria.md";
  });

  it("хлебные крошки с адресами нужного языка", () => {
    const jsonLd = breadcrumbJsonLd(
      [
        { name: "Acasă", path: "/" },
        { name: "Menu", path: "/menu" },
      ],
      "en"
    );
    expect(jsonLd.itemListElement[1]).toMatchObject({ position: 2, item: "https://lastoria.md/en/menu" });
  });

  it("Product + Offer в MDL, без выдуманных рейтингов", () => {
    const jsonLd = productJsonLd(
      {
        name: "Margherita",
        description: "Pizza clasică",
        images: ["/uploads/products/m.jpg"],
        price: 89,
        slug: "pizza-margarita",
        category: "Pizza",
        inStock: true,
        brand: "La Storia",
      },
      "ro"
    );
    expect(jsonLd.offers).toMatchObject({ price: "89.00", priceCurrency: "MDL", availability: "https://schema.org/InStock" });
    expect(jsonLd.url).toBe("https://lastoria.md/menu/pizza-margarita");
    expect(JSON.stringify(jsonLd)).not.toMatch(/aggregateRating|review/i);
  });

  it("FAQPage", () => {
    const jsonLd = faqJsonLd([{ q: "Livrați?", a: "Da." }], "ro");
    expect(jsonLd["@type"]).toBe("FAQPage");
    expect(jsonLd.mainEntity[0].acceptedAnswer.text).toBe("Da.");
  });
});

describe("SEO: короткие ответы и чеклист", () => {
  it("считает слова и проверяет диапазон 40–80", () => {
    expect(countWords("  one two   three ")).toBe(3);
    expect(isShortAnswerLengthOk(Array(39).fill("w").join(" "))).toBe(false);
    expect(isShortAnswerLengthOk(Array(60).fill("w").join(" "))).toBe(true);
    expect(isShortAnswerLengthOk(Array(81).fill("w").join(" "))).toBe(false);
  });

  it("plainText убирает markdown и обрезает", () => {
    expect(plainText("**Жирный** [ссылка](https://x.y) текст", 100)).toBe("Жирный ссылка текст");
    expect(plainText("a".repeat(200), 10)).toHaveLength(10);
  });

  it("чеклист отмечает пустой перевод и отсутствие фото", () => {
    const checks = productSeoChecklist({
      name: "",
      seoTitle: "",
      seoDescription: "",
      shortDescription: "",
      description: "",
      shortAnswer: "",
      imageAlt: "",
      hasImage: false,
    });
    expect(checks.find((c) => c.id === "name")?.ok).toBe(false);
    expect(checks.find((c) => c.id === "image")?.ok).toBe(false);
    expect(checks.find((c) => c.id === "answer")?.soft).toBe(true);
  });
});

describe("slug", () => {
  it("транслитерирует кириллицу и румынские/итальянские буквы", () => {
    expect(transliterate("Пицца")).toBe("pitstsa");
    expect(slugify("Pizza Diavola Țară")).toBe("pizza-diavola-tara");
    expect(slugify("Tiramisù")).toBe("tiramisu");
  });

  it("убирает недопустимые символы и двойные дефисы", () => {
    expect(slugify("  Пицца -- 4 сыра!! ")).toBe("pitstsa-4-syra");
  });
});
