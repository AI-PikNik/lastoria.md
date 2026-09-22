"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { SlidersHorizontal } from "lucide-react";
import type { ProductCardView } from "@/lib/catalog";
import type { AppLocale } from "@/lib/i18n/locales";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { ProductCard } from "./product-card";

export interface MenuGroup {
  id: string;
  slug: string;
  name: string;
  products: ProductCardView[];
}

interface Filters {
  promo: boolean;
  spicy: boolean;
  veg: boolean;
  min: string;
  max: string;
}

const EMPTY: Filters = { promo: false, spicy: false, veg: false, min: "", max: "" };

function applyFilters(products: ProductCardView[], f: Filters) {
  const min = f.min ? Number(f.min) : null;
  const max = f.max ? Number(f.max) : null;
  return products.filter(
    (p) =>
      (!f.promo || p.hasDiscount) &&
      (!f.spicy || p.isSpicy) &&
      (!f.veg || p.isVegetarian) &&
      (min == null || p.price >= min) &&
      (max == null || p.price <= max)
  );
}

function activeCount(f: Filters) {
  return [f.promo, f.spicy, f.veg, !!f.min || !!f.max].filter(Boolean).length;
}

/**
 * Каталог: чипы групп (горизонтальная прокрутка), фильтры — боковая панель
 * на десктопе и нижняя шторка (bottom sheet) на телефоне.
 */
export function MenuBrowser({
  groups,
  allGroups,
  locale,
  currentSlug,
}: {
  groups: MenuGroup[];
  /** все группы — для чипов навигации */
  allGroups: { slug: string; name: string }[];
  locale: AppLocale;
  currentSlug?: string;
}) {
  const t = useTranslations("menu");
  const [filters, setFilters] = React.useState<Filters>(EMPTY);
  const [draft, setDraft] = React.useState<Filters>(EMPTY);
  const [sheetOpen, setSheetOpen] = React.useState(false);

  const filtered = groups
    .map((group) => ({ ...group, products: applyFilters(group.products, filters) }))
    .filter((group) => group.products.length > 0);
  const count = activeCount(filters);

  return (
    <div className="lg:grid lg:grid-cols-[240px_1fr] lg:gap-8">
      {/* Чипы групп */}
      <nav
        aria-label={t("groups")}
        className="sticky top-[68px] z-30 -mx-4 mb-4 border-b border-border/70 bg-background/95 px-4 py-2 backdrop-blur sm:top-[76px] lg:col-span-2"
      >
        <ul className="no-scrollbar flex gap-2 overflow-x-auto">
          <li>
            <Chip href="/menu" active={!currentSlug}>
              {t("all")}
            </Chip>
          </li>
          {allGroups.map((g) => (
            <li key={g.slug}>
              <Chip href={`/menu/group/${g.slug}`} active={currentSlug === g.slug}>
                {g.name}
              </Chip>
            </li>
          ))}
        </ul>
      </nav>

      {/* Фильтры: десктоп */}
      <aside className="hidden lg:block">
        <div className="sticky top-36 rounded-xl bg-card p-5 shadow-card gold-frame">
          <p className="font-display text-lg font-bold text-primary">{t("filters")}</p>
          <FilterFields value={filters} onChange={setFilters} idPrefix="d" />
          {count > 0 && (
            <Button variant="ghost" className="mt-2 w-full" onClick={() => setFilters(EMPTY)}>
              {t("reset")}
            </Button>
          )}
        </div>
      </aside>

      <div>
        {/* Фильтры: телефон/планшет — нижняя шторка */}
        <div className="mb-4 flex justify-end lg:hidden">
          <Sheet
            open={sheetOpen}
            onOpenChange={(open) => {
              if (open) setDraft(filters);
              setSheetOpen(open);
            }}
          >
            <SheetTrigger asChild>
              <Button variant="outline">
                <SlidersHorizontal aria-hidden="true" />
                {t("filters")}
                {count > 0 && (
                  <span className="ml-1 rounded-full bg-primary px-2 text-xs text-primary-foreground">{count}</span>
                )}
              </Button>
            </SheetTrigger>
            <SheetContent side="bottom" closeLabel={t("apply")}>
              <SheetTitle>{t("filters")}</SheetTitle>
              <SheetDescription className="sr-only">{t("filters")}</SheetDescription>
              <FilterFields value={draft} onChange={setDraft} idPrefix="m" />
              <div className="mt-4 grid grid-cols-2 gap-2">
                <Button variant="outline" onClick={() => setDraft(EMPTY)}>
                  {t("reset")}
                </Button>
                <Button
                  onClick={() => {
                    setFilters(draft);
                    setSheetOpen(false);
                  }}
                >
                  {t("showResults")}
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>

        {filtered.length === 0 ? (
          <p className="rounded-xl bg-card p-8 text-center text-muted-foreground gold-frame">{t("empty")}</p>
        ) : (
          <div className="space-y-12">
            {filtered.map((group) => (
              <section key={group.id} id={`group-${group.slug}`} aria-labelledby={`h-${group.slug}`} className="scroll-mt-40">
                {groups.length > 1 && (
                  <h2 id={`h-${group.slug}`} className="mb-4 font-display text-2xl font-bold text-primary">
                    <Link href={`/menu/group/${group.slug}`} className="hover:underline">
                      {group.name}
                    </Link>
                  </h2>
                )}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-5 xl:grid-cols-3">
                  {group.products.map((product) => (
                    <ProductCard key={product.id} product={product} locale={locale} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Chip({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "inline-flex h-10 items-center whitespace-nowrap rounded-full border px-4 text-sm font-semibold transition-colors",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border-strong bg-card text-foreground hover:bg-surface"
      )}
    >
      {children}
    </Link>
  );
}

function FilterFields({
  value,
  onChange,
  idPrefix,
}: {
  value: Filters;
  onChange: (f: Filters) => void;
  idPrefix: string;
}) {
  const t = useTranslations("menu");
  const toggles: { key: "promo" | "spicy" | "veg"; label: string }[] = [
    { key: "promo", label: t("onlyPromo") },
    { key: "spicy", label: t("spicy") },
    { key: "veg", label: t("vegetarian") },
  ];
  return (
    <div className="mt-3 flex flex-col">
      {toggles.map((toggle) => (
        <label
          key={toggle.key}
          htmlFor={`${idPrefix}-${toggle.key}`}
          className="flex min-h-11 cursor-pointer items-center gap-3 text-[0.95rem]"
        >
          <Checkbox
            id={`${idPrefix}-${toggle.key}`}
            checked={value[toggle.key]}
            onCheckedChange={(checked) => onChange({ ...value, [toggle.key]: checked === true })}
          />
          {toggle.label}
        </label>
      ))}
      <fieldset className="mt-2">
        <legend className="mb-2 text-sm font-semibold">{t("price")}</legend>
        <div className="grid grid-cols-2 gap-2">
          <Input
            type="number"
            inputMode="numeric"
            min={0}
            placeholder={t("priceFrom")}
            aria-label={t("minPrice")}
            value={value.min}
            onChange={(e) => onChange({ ...value, min: e.target.value })}
          />
          <Input
            type="number"
            inputMode="numeric"
            min={0}
            placeholder={t("priceTo")}
            aria-label={t("maxPrice")}
            value={value.max}
            onChange={(e) => onChange({ ...value, max: e.target.value })}
          />
        </div>
      </fieldset>
    </div>
  );
}
