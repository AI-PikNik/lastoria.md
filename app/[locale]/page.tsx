import Image from "next/image";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Banknote, Bike, ShoppingBag } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { resolveLocaleParam } from "@/lib/i18n/server";
import { DEFAULT_HERO_IMAGE, getPublicSettings } from "@/lib/settings";
import { getCategories, getProductCards } from "@/lib/catalog";
import { formatMoney } from "@/lib/format";
import { buildMetadata, organizationJsonLd, restaurantJsonLd } from "@/lib/seo";
import { JsonLd } from "@/components/seo/json-ld";
import { ProductCard } from "@/components/public/product-card";
import { ShortAnswer } from "@/components/public/short-answer";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Flourish, OliveBranch, Plaque, SectionTitle } from "@/theme/decor";

export async function generateMetadata({ params }: PageProps<"/[locale]">): Promise<Metadata> {
  const locale = await resolveLocaleParam(params);
  const [settings, t] = await Promise.all([getPublicSettings(locale), getTranslations({ locale, namespace: "meta" })]);
  return buildMetadata({
    locale,
    path: "/",
    title: settings.seoTitle || t("defaultTitle"),
    description: settings.seoDescription || t("defaultDescription"),
    image: settings.heroImageUrl,
    absoluteTitle: true,
    siteName: settings.name,
  });
}

export default async function HomePage({ params }: PageProps<"/[locale]">) {
  const locale = await resolveLocaleParam(params);
  const [settings, categories, featured, t, tMeta] = await Promise.all([
    getPublicSettings(locale),
    getCategories(locale),
    getProductCards(locale, { isFeatured: true }, 8),
    getTranslations({ locale, namespace: "home" }),
    getTranslations({ locale, namespace: "meta" }),
  ]);
  const promoProducts = (await getProductCards(locale)).filter((p) => p.hasDiscount).slice(0, 4);
  const minOrder = formatMoney(settings.minOrderAmount, locale);
  const hours = settings.hours || "—";
  const heroImage = settings.heroImageUrl || DEFAULT_HERO_IMAGE;

  const shortAnswer =
    settings.shortAnswer ||
    t("shortAnswer", { brand: settings.name, city: tMeta("city"), hours, min: minOrder });

  const ldSettings = {
    name: settings.name,
    phone: settings.phone,
    address: settings.address,
    email: settings.email,
    hours: settings.hours,
    logoUrl: settings.logoUrl,
    imageUrl: heroImage,
    geo: settings.geo,
    description: settings.seoDescription || tMeta("defaultDescription"),
  };

  return (
    <>
      <JsonLd data={organizationJsonLd(ldSettings)} />
      <JsonLd data={restaurantJsonLd(ldSettings, locale)} />

      {/* ── Герой: постер в золотой рамке + вывеска ── */}
      <section className="fire-glow">
        <div className="mx-auto grid max-w-6xl items-center gap-6 px-4 pb-10 pt-5 md:gap-10 md:pt-10 lg:grid-cols-[1.15fr_1fr]">
          <div className="relative overflow-hidden rounded-xl gold-frame shadow-lift lg:order-2">
            <div className="relative aspect-[3/2]">
              <Image
                src={heroImage}
                alt={t("heroImageAlt")}
                fill
                priority
                sizes="(max-width: 1023px) 100vw, 560px"
                className="object-cover"
              />
            </div>
          </div>
          <Plaque className="px-5 py-7 text-center sm:px-8 lg:order-1 lg:py-10">
            <div className="flex items-center justify-center gap-3">
              <OliveBranch mirrored />
              <p className="font-accent text-lg italic text-foreground/80 sm:text-xl">{tMeta("subtitle")}</p>
              <OliveBranch />
            </div>
            <h1 className="mt-2 font-display text-[2.1rem] font-extrabold italic leading-[1.1] text-primary sm:text-5xl">
              {settings.name}
            </h1>
            <p className="mt-2 font-display text-xl font-semibold text-foreground sm:text-2xl">{t("heroTitle")}</p>
            <Flourish className="mx-auto mt-3" />
            <p className="mt-3 font-accent text-xl italic text-brick">{tMeta("tagline")}</p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
              <Link href="/menu" className={cn(buttonVariants({ size: "lg" }))}>
                {t("heroCta")}
              </Link>
              <Link href="/delivery" className={cn(buttonVariants({ size: "lg", variant: "outline" }))}>
                {t("heroSecondary")}
              </Link>
            </div>
            <p className="mt-5 text-sm text-muted-foreground">
              {hours} · {settings.address}
            </p>
          </Plaque>
        </div>
      </section>

      {/* ── Короткий ответ (для людей и AI-поиска) ── */}
      <section className="mx-auto max-w-3xl px-4">
        <ShortAnswer title={t("shortAnswerTitle")} text={shortAnswer} />
      </section>

      {/* ── Группы меню ── */}
      {categories.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 pt-14">
          <SectionTitle title={t("groupsTitle")} subtitle={t("groupsSubtitle")} />
          <ul className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {categories.map((category) => (
              <li key={category.id}>
                <Link
                  href={`/menu/group/${category.slug}`}
                  className="group flex h-full min-h-24 flex-col justify-end overflow-hidden rounded-xl bg-card p-4 shadow-card gold-frame hover:shadow-lift"
                >
                  <span className="font-display text-lg font-bold text-primary group-hover:underline">
                    {category.name}
                  </span>
                  {category.requiresAgeConfirm && (
                    <span className="mt-1 w-fit rounded-full bg-charcoal px-2 text-xs font-semibold text-cream">18+</span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ── Хиты ── */}
      {featured.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 pt-14">
          <SectionTitle title={t("hitsTitle")} subtitle={t("hitsSubtitle")} />
          <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4">
            {featured.map((product, index) => (
              <ProductCard key={product.id} product={product} locale={locale} priority={index < 2} />
            ))}
          </div>
          <div className="mt-6 text-center">
            <Link href="/menu" className={cn(buttonVariants({ variant: "outline" }))}>
              {t("allMenu")} →
            </Link>
          </div>
        </section>
      )}

      {/* ── Акции ── */}
      {promoProducts.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 pt-14">
          <SectionTitle title={t("promosTitle")} subtitle={t("promosSubtitle")} />
          <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4">
            {promoProducts.map((product) => (
              <ProductCard key={product.id} product={product} locale={locale} />
            ))}
          </div>
        </section>
      )}

      {/* ── История ── */}
      <section className="mx-auto max-w-4xl px-4 pt-16">
        <Plaque className="px-5 py-8 sm:px-10">
          <SectionTitle title={t("storyTitle")} subtitle={t("storySubtitle")} />
          <div className="mx-auto mt-6 max-w-2xl space-y-4 text-center text-foreground/90">
            <p>{t("story.p1")}</p>
            <p>{t("story.p2")}</p>
            <p>{t("story.p3")}</p>
          </div>
        </Plaque>
      </section>

      {/* ── Доставка / самовывоз / оплата ── */}
      <section className="mx-auto max-w-6xl px-4 pt-14">
        <div className="grid gap-4 md:grid-cols-3">
          <InfoCard icon={<Bike />} title={t("deliveryTitle")} text={t("deliveryText", { min: minOrder })} href="/delivery" />
          <InfoCard icon={<ShoppingBag />} title={t("pickupTitle")} text={t("pickupText")} href="/delivery" />
          <InfoCard icon={<Banknote />} title={t("paymentTitle")} text={t("paymentText")} href="/delivery" />
        </div>
      </section>
    </>
  );
}

function InfoCard({ icon, title, text, href }: { icon: React.ReactNode; title: string; text: string; href: string }) {
  return (
    <Link href={href} className="group flex gap-4 rounded-xl bg-card p-5 shadow-card gold-frame hover:shadow-lift">
      <span
        aria-hidden="true"
        className="flex size-12 shrink-0 items-center justify-center rounded-full bg-olive text-cream [&_svg]:size-6"
      >
        {icon}
      </span>
      <span>
        <span className="block font-display text-lg font-bold text-primary group-hover:underline">{title}</span>
        <span className="mt-1 block text-sm text-muted-foreground">{text}</span>
      </span>
    </Link>
  );
}
