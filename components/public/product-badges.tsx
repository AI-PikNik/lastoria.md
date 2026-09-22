import { useTranslations } from "next-intl";
import { Flame, Leaf, Percent, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface BadgeFlags {
  isFeatured: boolean;
  hasDiscount: boolean;
  ageRestricted: boolean;
  isSpicy: boolean;
  isVegetarian: boolean;
  promoName?: string | null;
}

/**
 * Бейджи товара. Всегда в потоке (flex-wrap), а не поверх фото —
 * на узких экранах они переносятся на новую строку и не накладываются.
 * Бейдж 18+ показывается всегда, его нельзя скрыть настройками.
 */
export function ProductBadges({ flags, className }: { flags: BadgeFlags; className?: string }) {
  const t = useTranslations("badges");
  const items = [
    flags.ageRestricted && (
      <Badge key="age" variant="age" title={t("age18")}>
        {t("age18")}
      </Badge>
    ),
    flags.hasDiscount && (
      <Badge key="promo" variant="promo" title={flags.promoName ?? t("promo")}>
        <Percent className="size-3" aria-hidden="true" />
        {t("promo")}
      </Badge>
    ),
    flags.isFeatured && (
      <Badge key="hit" variant="hit">
        <Star className="size-3" aria-hidden="true" />
        {t("hit")}
      </Badge>
    ),
    flags.isSpicy && (
      <Badge key="spicy" variant="spicy">
        <Flame className="size-3" aria-hidden="true" />
        {t("spicy")}
      </Badge>
    ),
    flags.isVegetarian && (
      <Badge key="veg" variant="veg">
        <Leaf className="size-3" aria-hidden="true" />
        {t("vegetarian")}
      </Badge>
    ),
  ].filter(Boolean);

  if (items.length === 0) return null;
  return <div className={cn("flex flex-wrap gap-1.5", className)}>{items}</div>;
}
