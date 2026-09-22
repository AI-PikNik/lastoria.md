import { formatMoney } from "@/lib/format";
import type { AppLocale } from "@/lib/i18n/locales";
import { cn } from "@/lib/utils";

export function Price({
  price,
  oldPrice,
  locale,
  fromLabel,
  size = "md",
  className,
}: {
  price: number;
  oldPrice?: number | null;
  locale: AppLocale;
  /** «от» — для товаров с вариантами */
  fromLabel?: string;
  size?: "md" | "lg";
  className?: string;
}) {
  return (
    <p className={cn("flex flex-wrap items-baseline gap-x-2", className)}>
      {fromLabel && <span className="text-sm text-muted-foreground">{fromLabel}</span>}
      <span className={cn("font-display font-bold text-primary", size === "lg" ? "text-3xl" : "text-lg")}>
        {formatMoney(price, locale)}
      </span>
      {oldPrice != null && oldPrice > price && (
        <s className={cn("text-muted-foreground", size === "lg" ? "text-lg" : "text-sm")}>
          {formatMoney(oldPrice, locale)}
        </s>
      )}
    </p>
  );
}
