/**
 * ДЕКОРАТИВНЫЕ ЭЛЕМЕНТЫ ТЕМЫ (оливковые ветви, орнамент, флажок, плашки).
 * Всё нарисовано inline-SVG и красится через currentColor / CSS-переменные,
 * поэтому смена палитры в theme/tokens.css перекрашивает и декор.
 */
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface DecorProps {
  className?: string;
}

/** Оливковая ветвь. mirrored — зеркальная (для пары по бокам заголовка). */
export function OliveBranch({ className, mirrored }: DecorProps & { mirrored?: boolean }) {
  return (
    <svg
      viewBox="0 0 64 32"
      aria-hidden="true"
      focusable="false"
      className={cn("h-6 w-12 text-olive", mirrored && "-scale-x-100", className)}
    >
      <path d="M2 28 C 18 24, 34 18, 62 4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      {[
        [12, 24.5, -35],
        [20, 21.5, 25],
        [28, 18, -40],
        [36, 14.5, 20],
        [44, 11, -45],
        [52, 7.5, 15],
      ].map(([x, y, r], i) => (
        <ellipse
          key={i}
          cx={x}
          cy={y + (i % 2 === 0 ? -3.5 : 3.5)}
          rx="4.6"
          ry="1.9"
          transform={`rotate(${r} ${x} ${y + (i % 2 === 0 ? -3.5 : 3.5)})`}
          fill="currentColor"
          opacity={0.85}
        />
      ))}
      <circle cx="58" cy="9" r="1.8" fill="var(--c-olive-dark)" />
    </svg>
  );
}

/** Золотой завиток-разделитель (как под «Pizzeria» на постере) */
export function Flourish({ className }: DecorProps) {
  return (
    <svg
      viewBox="0 0 120 16"
      aria-hidden="true"
      focusable="false"
      className={cn("h-4 w-28 text-gold", className)}
    >
      <path
        d="M2 8 H44 C50 8 52 3 57 3 C61 3 62 7 60 9 C58 11 55 9 57 7 M118 8 H76 C70 8 68 13 63 13 C59 13 58 9 60 7 C62 5 65 7 63 9"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <path d="M60 4 L63 8 L60 12 L57 8 Z" fill="currentColor" />
    </svg>
  );
}

/** Маленький итальянский флажок (используется только в шапке и подвале) */
export function FlagMark({ className }: DecorProps) {
  return (
    <span
      aria-hidden="true"
      className={cn("inline-block h-2.5 w-6 rounded-[2px] flag-stripe ring-1 ring-gold/60", className)}
    />
  );
}

/** Узкая полоса итальянского флага во всю ширину */
export function FlagStripe({ className }: DecorProps) {
  return <div aria-hidden="true" className={cn("flag-stripe h-1 w-full", className)} />;
}

/** Полоса «клетчатой скатерти» */
export function CheckeredStrip({ className }: DecorProps) {
  return <div aria-hidden="true" className={cn("checkered h-2.5 w-full opacity-80", className)} />;
}

/** Пергаментная плашка с золотой рамкой */
export function Plaque({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("plaque", className)}>{children}</div>;
}

/** Заголовок раздела: ветви по бокам + курсивный подзаголовок */
export function SectionTitle({
  title,
  subtitle,
  as: Tag = "h2",
  className,
  align = "center",
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  as?: "h1" | "h2" | "h3";
  className?: string;
  align?: "center" | "left";
}) {
  const centered = align === "center";
  return (
    <div className={cn("flex flex-col gap-1", centered ? "items-center text-center" : "items-start", className)}>
      <div className="flex items-center gap-3">
        {centered && <OliveBranch mirrored className="hidden sm:block" />}
        <Tag className="font-display text-2xl font-bold leading-tight text-primary sm:text-3xl md:text-4xl">
          {title}
        </Tag>
        {centered && <OliveBranch className="hidden sm:block" />}
      </div>
      {subtitle && (
        <p className="font-accent text-lg italic text-muted-foreground sm:text-xl">{subtitle}</p>
      )}
      <Flourish className="mt-1" />
    </div>
  );
}

/** Текстовый логотип «La Storia» (если в настройках не загружен свой) */
export function TextLogo({
  name,
  subtitle,
  size = "md",
  className,
}: {
  name: string;
  subtitle?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  return (
    <span className={cn("inline-flex flex-col leading-none", className)}>
      <span
        className={cn(
          "font-display font-extrabold italic tracking-tight text-primary",
          size === "sm" && "text-xl",
          size === "md" && "text-2xl sm:text-[1.7rem]",
          size === "lg" && "text-5xl sm:text-7xl"
        )}
      >
        {name}
      </span>
      {subtitle && (
        <span
          className={cn(
            "font-accent italic text-foreground/80",
            size === "lg" ? "mt-2 text-xl sm:text-2xl" : "mt-0.5 text-[0.8rem]"
          )}
        >
          {subtitle}
        </span>
      )}
    </span>
  );
}
