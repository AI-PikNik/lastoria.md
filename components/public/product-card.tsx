import Image from "next/image";
import { useTranslations } from "next-intl";
import { ChevronRight } from "lucide-react";
import { Link } from "@/i18n/navigation";
import type { ProductCardView } from "@/lib/catalog";
import type { AppLocale } from "@/lib/i18n/locales";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AddToCartButton } from "./add-to-cart-button";
import { ProductBadges } from "./product-badges";
import { Price } from "./price";

/**
 * Карточка товара.
 * Телефон: горизонтальная (фото слева) — меню читается быстрее, меньше прокрутки.
 * Планшет и шире: вертикальная, 2–4 колонки.
 */
export function ProductCard({
  product,
  locale,
  priority = false,
}: {
  product: ProductCardView;
  locale: AppLocale;
  priority?: boolean;
}) {
  const t = useTranslations("product");
  const tMenu = useTranslations("menu");
  const href = `/menu/${product.slug}`;

  return (
    <article className="group relative flex h-full gap-3 overflow-hidden rounded-xl bg-card p-2.5 shadow-card gold-frame transition-shadow hover:shadow-lift sm:flex-col sm:gap-0 sm:p-0">
      <Link
        href={href}
        className="relative block aspect-square w-28 shrink-0 self-start overflow-hidden rounded-lg bg-surface sm:aspect-[4/3] sm:self-auto sm:w-full sm:rounded-none sm:rounded-t-xl"
        tabIndex={-1}
        aria-hidden="true"
      >
        {product.imageUrl ? (
          <Image
            src={product.imageUrl}
            alt=""
            fill
            priority={priority}
            sizes="(max-width: 639px) 112px, (max-width: 1023px) 50vw, (max-width: 1279px) 33vw, 290px"
            className="object-cover transition-transform duration-300 group-hover:scale-[1.04]"
          />
        ) : (
          <span className="flex h-full items-center justify-center font-display text-3xl italic text-gold">LS</span>
        )}
      </Link>

      <div className="flex min-w-0 flex-1 flex-col gap-1.5 sm:p-4">
        <ProductBadges flags={product} />
        <h3 className="font-display text-lg font-bold leading-snug text-foreground">
          <Link href={href} className="hover:text-primary focus-visible:text-primary">
            {product.name}
          </Link>
        </h3>
        {product.shortDescription && (
          <p className="line-clamp-2 text-sm leading-snug text-muted-foreground">{product.shortDescription}</p>
        )}
        <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-1.5">
          <Price
            price={product.price}
            oldPrice={product.oldPrice}
            locale={locale}
            fromLabel={product.hasVariants ? tMenu("priceFrom") : undefined}
          />
          {product.hasVariants ? (
            <Link href={href} className={cn(buttonVariants({ variant: "outline" }), "px-3")}>
              {t("choose")}
              <ChevronRight aria-hidden="true" />
            </Link>
          ) : (
            <AddToCartButton productId={product.id} name={product.name} ageRestricted={product.ageRestricted} />
          )}
        </div>
      </div>
    </article>
  );
}
