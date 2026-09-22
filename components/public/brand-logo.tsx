import Image from "next/image";
import { TextLogo } from "@/theme/decor";

/** Логотип: загруженный в настройках файл или текстовый логотип темы */
export function BrandLogo({
  name,
  logoUrl,
  subtitle,
  size = "md",
}: {
  name: string;
  logoUrl: string | null;
  subtitle?: string;
  size?: "sm" | "md";
}) {
  if (logoUrl) {
    return (
      <Image
        src={logoUrl}
        alt={name}
        width={size === "sm" ? 120 : 160}
        height={size === "sm" ? 40 : 52}
        className={size === "sm" ? "h-10 w-auto" : "h-12 w-auto sm:h-[52px]"}
        priority
        unoptimized={logoUrl.endsWith(".svg")}
      />
    );
  }
  return <TextLogo name={name} subtitle={subtitle} size={size} />;
}
