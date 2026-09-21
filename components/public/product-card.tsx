import Image from "next/image";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { AddToCartButton } from "./add-to-cart-button";
import { formatMoney } from "@/lib/format";

export interface ProductCardData {
  id: string;
  slug: string;
  name: string;
  shortDescription: string | null;
  imageUrl: string | null;
  isAlcohol: boolean;
  isVegetarian: boolean;
  isSpicy: boolean;
  isFeatured: boolean;
  price: number;
  oldPrice: number | null;
  hasDiscount: boolean;
}

export function ProductCard({ product }: { product: ProductCardData }) {
  return (
    <div className="group flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm transition-shadow hover:shadow-md">
      <Link href={`/menu/${product.slug}`} className="relative block aspect-square overflow-hidden bg-muted">
        {product.imageUrl ? (
          <Image
            src={product.imageUrl}
            alt={product.name}
            fill
            sizes="(max-width: 768px) 50vw, 280px"
            className="object-cover transition-transform group-hover:scale-105"
          />
        ) : null}
        <div className="absolute left-2 top-2 flex flex-wrap gap-1">
          {product.isFeatured && <Badge variant="accent">Хит</Badge>}
          {product.hasDiscount && <Badge variant="destructive">Акция</Badge>}
          {product.isAlcohol && <Badge variant="dark">18+</Badge>}
          {product.isSpicy && <Badge variant="secondary">Острое</Badge>}
          {product.isVegetarian && <Badge variant="secondary">Вег.</Badge>}
        </div>
      </Link>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <Link href={`/menu/${product.slug}`}>
          <h3 className="font-display font-semibold leading-snug hover:text-primary">
            {product.name}
          </h3>
        </Link>
        {product.shortDescription && (
          <p className="line-clamp-2 text-sm text-muted-foreground">
            {product.shortDescription}
          </p>
        )}
        <div className="mt-auto flex items-center justify-between pt-2">
          <div className="flex items-baseline gap-2">
            <span className="font-semibold text-primary">{formatMoney(product.price)}</span>
            {product.oldPrice && (
              <span className="text-sm text-muted-foreground line-through">
                {formatMoney(product.oldPrice)}
              </span>
            )}
          </div>
          <AddToCartButton
            productId={product.id}
            name={product.name}
            isAlcohol={product.isAlcohol}
            size="sm"
          />
        </div>
      </div>
    </div>
  );
}
