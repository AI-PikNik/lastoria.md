"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Menu, Phone } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { NavLinks } from "./nav-links";
import { LanguageSwitcher } from "./language-switcher";
import { FlagStripe, OliveBranch } from "@/theme/decor";

/** Гамбургер-меню для телефона и планшета: разделы, язык, телефон */
export function MobileMenu({ phone, phoneHref, hours }: { phone: string; phoneHref: string; hours: string }) {
  const t = useTranslations("nav");
  const [open, setOpen] = React.useState(false);
  const close = () => setOpen(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        className="inline-flex h-11 w-11 items-center justify-center rounded-md text-foreground hover:bg-surface lg:hidden"
        aria-label={t("openMenu")}
      >
        <Menu className="size-6" aria-hidden="true" />
      </SheetTrigger>
      <SheetContent side="right" closeLabel={t("closeMenu")} className="gap-6">
        <div>
          <SheetTitle>La Storia</SheetTitle>
          <SheetDescription className="sr-only">{t("mainNav")}</SheetDescription>
          <FlagStripe className="mt-3 w-16 rounded" />
        </div>
        <nav aria-label={t("mainNav")}>
          <NavLinks
            onNavigate={close}
            className="flex flex-col divide-y divide-border"
            itemClassName="w-full text-lg"
          />
        </nav>
        <LanguageSwitcher variant="list" onNavigate={close} />
        <div className="mt-auto rounded-lg border border-border-strong bg-card p-4">
          <a href={phoneHref} className="flex h-11 items-center gap-2 text-lg font-semibold text-primary">
            <Phone className="size-5" aria-hidden="true" />
            {phone}
          </a>
          {hours && <p className="text-sm text-muted-foreground">{hours}</p>}
          <OliveBranch className="mt-2" />
        </div>
      </SheetContent>
    </Sheet>
  );
}
