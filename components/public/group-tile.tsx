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

/** Плитка группы на главной: картинка из админки (Группы → картинка) или иконка */
export function GroupTile({ category }: { category: CategoryView }) {
  const Icon = KIND_ICON[category.kind];
  return (
    <Link
      href={`/menu/group/${category.slug}`}
      className="group flex h-full flex-col overflow-hidden rounded-xl bg-card shadow-card gold-frame transition-shadow hover:shadow-lift"
    >
      <span className="relative block aspect-[4/3] overflow-hidden bg-surface">
        {category.imageUrl ? (
          <Image
            src={category.imageUrl}
            alt=""
            fill
            sizes="(max-width: 639px) 50vw, (max-width: 1023px) 33vw, 280px"
            className="object-cover transition-transform duration-300 group-hover:scale-[1.04]"
          />
        ) : (
          <span className="flex h-full items-center justify-center bg-[radial-gradient(circle_at_50%_40%,var(--c-cream),var(--surface))]">
            <span className="flex size-16 items-center justify-center rounded-full border-2 border-gold bg-card text-primary shadow-sm sm:size-20">
              <Icon className="size-8 sm:size-10" strokeWidth={1.6} aria-hidden="true" />
            </span>
          </span>
        )}
        {category.requiresAgeConfirm && (
          <span className="absolute right-2 top-2 rounded-full bg-charcoal px-2 text-xs font-semibold leading-5 text-cream">18+</span>
        )}
      </span>
      <span className="flex flex-1 items-center justify-between gap-2 px-3 py-3 sm:px-4">
        <span className="font-display text-base font-bold leading-tight text-primary group-hover:underline sm:text-lg">
          {category.name}
        </span>
        <span aria-hidden="true" className="text-gold">→</span>
      </span>
    </Link>
  );
}
