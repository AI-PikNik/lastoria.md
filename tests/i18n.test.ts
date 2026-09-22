import { describe, expect, it } from "vitest";
import { fallbackOrder, missingInMap, missingLocales, pickLocalized, pickTranslation } from "@/lib/i18n/translate";
import { isLocale, localizedPath } from "@/lib/i18n/locales";
import { applyFlatOverrides, flattenMessages, mergeMessages } from "@/lib/i18n/messages-utils";
import ro from "@/messages/ro.json";
import ru from "@/messages/ru.json";
import en from "@/messages/en.json";
import it_ from "@/messages/it.json";

describe("выбор языка и fallback", () => {
  it("порядок: текущий → румынский → остальные", () => {
    expect(fallbackOrder("it")).toEqual(["it", "ro", "ru", "en"]);
    expect(fallbackOrder("ro")).toEqual(["ro", "ru", "en", "it"]);
  });

  it("pickLocalized берёт румынский, если нет перевода", () => {
    expect(pickLocalized({ ro: "Centru", ru: "" }, "ru")).toBe("Centru");
    expect(pickLocalized({ en: "Only EN" }, "it")).toBe("Only EN");
    expect(pickLocalized(null, "ro", "—")).toBe("—");
  });

  it("pickTranslation работает по каждому полю и помечает отсутствие перевода", () => {
    const rows = [
      { locale: "ro", name: "Margherita", description: "Descriere" },
      { locale: "ru", name: "Маргарита", description: "" },
    ];
    const ru = pickTranslation(rows, "ru", ["name", "description"] as const);
    expect(ru.values).toEqual({ name: "Маргарита", description: "Descriere" });
    expect(ru.missing).toBe(false);
    const en = pickTranslation(rows, "en", ["name"] as const);
    expect(en.values.name).toBe("Margherita");
    expect(en.missing).toBe(true);
  });

  it("missingLocales / missingInMap для жёлтых бейджей админки", () => {
    expect(missingLocales([{ locale: "ro", name: "A" }, { locale: "ru", name: " " }], "name")).toEqual(["ru", "en", "it"]);
    expect(missingInMap({ ro: "a", ru: "b", en: "c" })).toEqual(["it"]);
  });

  it("адреса: ro без префикса, остальные с префиксом", () => {
    expect(localizedPath("ro", "/menu")).toBe("/menu");
    expect(localizedPath("ro", "/")).toBe("/");
    expect(localizedPath("it", "/")).toBe("/it");
    expect(localizedPath("en", "/delivery")).toBe("/en/delivery");
    expect(isLocale("ru")).toBe(true);
    expect(isLocale("de")).toBe(false);
  });
});

describe("словари интерфейса", () => {
  it("во всех 4 словарях одинаковый набор ключей", () => {
    const keys = Object.keys(flattenMessages(ro)).sort();
    for (const dict of [ru, en, it_]) expect(Object.keys(flattenMessages(dict)).sort()).toEqual(keys);
  });

  it("в переводах сохранены те же {переменные}, что в румынском", () => {
    const base = flattenMessages(ro);
    const vars = (s: string) => (s.match(/\{(\w+)[,}]/g) ?? []).map((v) => v.slice(1, -1)).sort();
    for (const dict of [ru, en, it_]) {
      const flat = flattenMessages(dict);
      for (const [key, value] of Object.entries(base)) expect(vars(flat[key]), key).toEqual(vars(value));
    }
  });

  it("правки из админки накладываются поверх словаря, пропуски берутся из румынского", () => {
    const merged = mergeMessages({ a: { b: "ro-b", c: "ro-c" } }, { a: { b: "ru-b" } });
    expect(merged).toEqual({ a: { b: "ru-b", c: "ro-c" } });
    expect(applyFlatOverrides(merged, { "a.c": "admin" })).toEqual({ a: { b: "ru-b", c: "admin" } });
  });
});
