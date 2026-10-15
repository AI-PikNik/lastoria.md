import Image from "next/image";
import { ChefHat, CupSoda, Pizza, UtensilsCrossed, Wine } from "lucide-react";
import { Link } from "@/i18n/navigation";
import type { CategoryView } from "@/lib/catalog";
import type { CategoryKind } from "@/lib/generated/prisma/client";

/** Иконка по типу группы — если у группы не загружена картинка */
const KIND_ICON: Record<CategoryKind, typeof Pizza> = {
  PIZZA: Pizza,
  DRINK: CupSoda,
  ALCOHOL: Wine,
  OTHER: UtensilsCrossed,
  CUSTOM: ChefHat,
};

/**
 * Плитка группы на главной: слева картинка из админки (Группы → картинка)
 * или иконка по типу — не больше 44 px (≈12 мм), справа название.
 */
export function GroupTile({ category }: { category: CategoryView }) {
  const Icon = KIND_ICON[category.kind];
  return (
    <Link
      href={`/menu/group/${category.slug}`}
      className="group flex h-full min-h-[4.5rem] items-center gap-2.5 rounded-xl bg-card px-3 py-3 shadow-card gold-frame transition-shadow hover:shadow-lift sm:px-4"
    >
      <span className="relative shrink-0">
        <span className="relative flex size-11 items-center justify-center overflow-hidden rounded-full border-2 border-gold bg-surface text-primary">
          {category.imageUrl ? (
            <Image src={category.imageUrl} alt="" fill sizes="44px" className="object-cover" />
          ) : (
            <Icon className="size-6" strokeWidth={1.8} aria-hidden="true" />
          )}
        </span>
        {category.requiresAgeConfirm && (
          <span className="absolute -right-2 -top-1.5 rounded-full bg-charcoal px-1.5 text-[0.65rem] font-semibold leading-4 text-cream">
            18+
          </span>
        )}
      </span>
      <span className="min-w-0 flex-1 font-display text-[0.95rem] font-bold leading-tight text-primary group-hover:underline sm:text-lg">
        {category.name}
      </span>
      <span aria-hidden="true" className="hidden shrink-0 text-gold min-[400px]:inline">
        →
      </span>
    </Link>
  );
}
