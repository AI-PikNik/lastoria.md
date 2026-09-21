import { describe, expect, it, beforeEach } from "vitest";
import { buildMetadata, absoluteUrl, breadcrumbJsonLd, productJsonLd } from "@/lib/seo";
import { slugify, transliterate } from "@/lib/slug";

describe("seo helpers", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://lastoria.md";
  });

  it("строит canonical и OG-данные из абсолютного URL сайта", () => {
    const metadata = buildMetadata({
      title: "Пицца Маргарита",
      description: "Классическая пицца",
      path: "/menu/pizza-margarita",
    });

    expect(metadata.alternates?.canonical).toBe("https://lastoria.md/menu/pizza-margarita");
    expect(metadata.openGraph?.url).toBe("https://lastoria.md/menu/pizza-margarita");
    expect(metadata.robots).toEqual({ index: true, follow: true });
  });

  it("выставляет noindex, когда запрошено", () => {
    const metadata = buildMetadata({
      title: "Корзина",
      description: "",
      path: "/cart",
      noIndex: true,
    });

    expect(metadata.robots).toEqual({ index: false, follow: false });
  });

  it("absoluteUrl всегда возвращает путь с ведущим слэшем", () => {
    expect(absoluteUrl("menu")).toBe("https://lastoria.md/menu");
    expect(absoluteUrl("/menu")).toBe("https://lastoria.md/menu");
  });

  it("строит хлебные крошки в формате schema.org", () => {
    const jsonLd = breadcrumbJsonLd([
      { name: "Главная", path: "/" },
      { name: "Меню", path: "/menu" },
    ]);

    expect(jsonLd["@type"]).toBe("BreadcrumbList");
    expect(jsonLd.itemListElement).toHaveLength(2);
    expect(jsonLd.itemListElement[1]).toMatchObject({
      position: 2,
      name: "Меню",
      item: "https://lastoria.md/menu",
    });
  });

  it("строит корректный Product JSON-LD с ценой в MDL", () => {
    const jsonLd = productJsonLd({
      name: "Маргарита",
      description: "Классическая пицца",
      imageUrl: "/uploads/products/margarita.jpg",
      price: 89,
      slug: "pizza-margarita",
      isActive: true,
    });

    expect(jsonLd.offers).toMatchObject({
      price: "89.00",
      priceCurrency: "MDL",
      availability: "https://schema.org/InStock",
    });
  });
});

describe("slug helpers", () => {
  it("транслитерирует кириллицу в латиницу", () => {
    expect(transliterate("Пицца")).toBe("pitstsa");
  });

  it("создаёт ЧПУ-slug из русского названия", () => {
    expect(slugify("Пицца Дьябло")).toBe("pitstsa-dyablo");
  });

  it("убирает недопустимые символы и двойные дефисы", () => {
    expect(slugify("Соус №1 (острый!!)")).toBe("sous-1-ostryy");
  });
});
