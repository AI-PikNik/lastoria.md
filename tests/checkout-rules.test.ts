import { describe, expect, it } from "vitest";
import { formatMoldovanPhone, isValidMoldovanPhone, normalizeMoldovanPhone } from "@/lib/phone";
import { analyticsAllowed, parseConsent, readConsentFromCookieString, serializeConsentCookie } from "@/lib/consent";
import { computeDeliveryFee, localizeCities } from "@/lib/delivery";
import { checkoutSchema } from "@/lib/validation";
import { buildLlmsTxt } from "@/lib/llms";

describe("телефон: +373 или 0 (Молдова и Приднестровье)", () => {
  it.each([
    ["+373 69 123 456", "+37369123456"],
    ["069123456", "+37369123456"],
    ["0 (79) 12-34-56", "+37379123456"],
    ["+37360123456", "+37360123456"],
    ["0775 12345", "+37377512345"], // IDC, Приднестровье
    ["+373 533 12345", "+37353312345"], // Тирасполь, стационарный
    ["022 123 456", "+37322123456"], // Кишинёв, стационарный
    ["00373 68 000 111", "+37368000111"],
  ])("%s → %s", (input, expected) => {
    expect(normalizeMoldovanPhone(input)).toBe(expected);
  });

  it.each(["", "12345", "+40 712 345 678", "+7 999 123 45 67", "69123456", "0691234567", "+373 49 123 456", "+3736912345"])(
    "отклоняет %s",
    (input) => {
      expect(isValidMoldovanPhone(input)).toBe(false);
    }
  );

  it("форматирует для писем и админки", () => {
    expect(formatMoldovanPhone("+37369123456")).toBe("+373 69 123 456");
  });

  it("схема заказа нормализует телефон и возвращает ключ ошибки словаря", () => {
    const base = { customerName: "Ion", fulfillment: "PICKUP", items: [{ productId: "p", qty: 1 }] };
    const ok = checkoutSchema.safeParse({ ...base, phone: "069 123 456" });
    expect(ok.success && ok.data.phone).toBe("+37369123456");
    const bad = checkoutSchema.safeParse({ ...base, phone: "12345" });
    expect(bad.success).toBe(false);
    expect(bad.error?.issues[0].message).toBe("validation.phoneInvalid");
  });

  it("для доставки нужен адрес", () => {
    const result = checkoutSchema.safeParse({
      customerName: "Ion",
      phone: "069123456",
      fulfillment: "DELIVERY",
      items: [{ productId: "p", qty: 1 }],
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((i) => i.message)).toContain("validation.addressRequired");
  });
});

describe("cookie-согласие", () => {
  it("аналитика только после «Принять все»", () => {
    expect(analyticsAllowed("all")).toBe(true);
    expect(analyticsAllowed("necessary")).toBe(false);
    expect(analyticsAllowed(null)).toBe(false);
  });

  it("читает выбор из cookie и игнорирует мусор", () => {
    expect(readConsentFromCookieString("a=1; ls_consent=necessary; b=2")).toBe("necessary");
    expect(readConsentFromCookieString("ls_consent=hack")).toBeNull();
    expect(parseConsent(undefined)).toBeNull();
  });

  it("запоминает выбор на год", () => {
    const cookie = serializeConsentCookie("all", true);
    expect(cookie).toContain("ls_consent=all");
    expect(cookie).toContain(`Max-Age=${60 * 60 * 24 * 365}`);
    expect(cookie).toContain("Secure");
  });
});

describe("доставка по районам", () => {
  it("стоимость района и бесплатная доставка от суммы", () => {
    expect(computeDeliveryFee({ fee: 50, freeFrom: null }, 1000)).toBe(50);
    expect(computeDeliveryFee({ fee: 50, freeFrom: 500 }, 499)).toBe(50);
    expect(computeDeliveryFee({ fee: 50, freeFrom: 500 }, 500)).toBe(0);
    expect(computeDeliveryFee(null, 100)).toBe(0);
  });

  it("названия городов/районов на языке покупателя, пустые города скрываются", () => {
    const cities = localizeCities(
      [
        { id: "c1", slug: "chisinau", names: { ro: "Chișinău", ru: "Кишинёв" }, zones: [{ id: "z1", names: { ro: "Poșta Veche" }, fee: 40, freeFrom: null }] },
        { id: "c2", slug: "balti", names: { ro: "Bălți" }, zones: [] },
      ],
      "ru"
    );
    expect(cities).toHaveLength(1);
    expect(cities[0].name).toBe("Кишинёв");
    expect(cities[0].zones[0].name).toBe("Poșta Veche");
  });
});

describe("/llms.txt", () => {
  it("собирается из данных сайта со ссылками на все языки", () => {
    const text = buildLlmsTxt({
      siteUrl: "https://lastoria.md",
      locale: "en",
      name: "La Storia",
      description: "Italian pizzeria in Chișinău.",
      address: "str. Test 1",
      phone: "+373 22 000 000",
      email: null,
      hours: "Daily 10–22",
      minOrder: "100 MDL",
      groups: [{ name: "Pizza", slug: "pizza", ageRestricted: false, products: [{ name: "Margherita", slug: "pizza-margarita", price: "89 MDL", description: "Classic" }] }],
      delivery: [{ city: "Chișinău", zones: [{ name: "Centru", fee: "50 MDL" }] }],
    });
    expect(text.startsWith("# La Storia")).toBe(true);
    expect(text).toContain("> Italian pizzeria in Chișinău.");
    expect(text).toContain("[Margherita](https://lastoria.md/en/menu/pizza-margarita) — 89 MDL");
    expect(text).toContain("Română (https://lastoria.md/)");
    expect(text).toContain("- Chișinău, Centru: 50 MDL");
  });
});
