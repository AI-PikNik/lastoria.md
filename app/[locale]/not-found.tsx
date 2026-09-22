import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { buttonVariants } from "@/components/ui/button";
import { Flourish, OliveBranch, Plaque } from "@/theme/decor";

export default async function NotFound() {
  const t = await getTranslations("errors");
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center px-4 py-16 text-center">
      <Plaque className="w-full px-6 py-10">
        <div className="flex items-center justify-center gap-3">
          <OliveBranch mirrored />
          <p className="font-display text-6xl font-extrabold italic text-primary">404</p>
          <OliveBranch />
        </div>
        <h1 className="mt-3 font-display text-2xl font-bold">{t("notFoundTitle")}</h1>
        <Flourish className="mx-auto mt-2" />
        <p className="mt-3 text-muted-foreground">{t("notFoundText")}</p>
        <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
          <Link href="/" className={buttonVariants()}>
            {t("backHome")}
          </Link>
          <Link href="/menu" className={buttonVariants({ variant: "outline" })}>
            {t("toMenu")}
          </Link>
        </div>
      </Plaque>
    </div>
  );
}
