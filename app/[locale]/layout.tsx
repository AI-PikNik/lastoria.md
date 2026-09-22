import type { Metadata, Viewport } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";
import { Toaster } from "sonner";
import "../globals.css";
import { fontVariables } from "@/theme/fonts";
import { routing } from "@/i18n/routing";
import { resolveLocaleParam } from "@/lib/i18n/server";
import { getPublicSettings } from "@/lib/settings";
import { getSiteUrl } from "@/lib/site-url";
import type { MessageTree } from "@/lib/i18n/messages-utils";
import { CartProvider } from "@/components/cart/cart-context";
import { AgeGateProvider } from "@/components/age-gate/age-gate-context";
import { ConsentProvider } from "@/components/public/consent/consent-context";
import { CookieBanner } from "@/components/public/consent/cookie-banner";
import { ConsentedAnalytics } from "@/components/public/consent/consented-analytics";
import { Header } from "@/components/public/header";
import { Footer } from "@/components/public/footer";
import { StickyCartBar } from "@/components/public/sticky-cart-bar";

// Публичные страницы — статические с обновлением раз в 5 минут; любые правки
// в админке дополнительно сбрасывают кэш сразу (revalidatePath в actions).
export const revalidate = 300;

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export const viewport: Viewport = {
  themeColor: "#7a1f1f",
  width: "device-width",
  initialScale: 1,
};

export async function generateMetadata({ params }: LayoutProps<"/[locale]">): Promise<Metadata> {
  const locale = await resolveLocaleParam(params);
  const [settings, t] = await Promise.all([getPublicSettings(locale), getTranslations({ locale, namespace: "meta" })]);
  const icon = settings.faviconUrl ?? "/icon";
  return {
    metadataBase: new URL(getSiteUrl()),
    title: {
      default: settings.seoTitle || t("defaultTitle"),
      template: `%s | ${settings.name}`,
    },
    description: settings.seoDescription || t("defaultDescription"),
    applicationName: settings.name,
    icons: { icon: [{ url: icon }], apple: [{ url: settings.faviconUrl ?? "/apple-icon" }] },
    formatDetection: { telephone: false },
  };
}

/** Ветки словаря, которые нужны клиентским компонентам */
const CLIENT_NAMESPACES = [
  "common",
  "nav",
  "header",
  "badges",
  "menu",
  "product",
  "cart",
  "checkout",
  "validation",
  "order",
  "ageGate",
  "cookies",
  "lang",
  "errors",
];

export default async function LocaleLayout({ children, params }: LayoutProps<"/[locale]">) {
  const locale = await resolveLocaleParam(params);
  const [messages, settings, t] = await Promise.all([
    getMessages(),
    getPublicSettings(locale),
    getTranslations("common"),
  ]);
  const clientMessages: MessageTree = Object.fromEntries(
    CLIENT_NAMESPACES.filter((ns) => ns in messages).map((ns) => [ns, (messages as MessageTree)[ns]])
  );

  return (
    <html lang={locale} className={`${fontVariables} antialiased`}>
      <body className="paper-texture flex min-h-screen flex-col font-sans text-[1.0625rem] leading-relaxed">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[100] focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
        >
          {t("skipToContent")}
        </a>
        <NextIntlClientProvider locale={locale} messages={clientMessages}>
          <ConsentProvider>
            <CartProvider>
              <AgeGateProvider>
                <Header locale={locale} settings={settings} />
                <main id="main" className="flex-1 pb-24 lg:pb-0">
                  {children}
                </main>
                <Footer locale={locale} settings={settings} />
                <StickyCartBar />
                {settings.cookieBannerEnabled && <CookieBanner />}
                <ConsentedAnalytics analyticsId={settings.analyticsId} />
              </AgeGateProvider>
            </CartProvider>
          </ConsentProvider>
        </NextIntlClientProvider>
        <Toaster position="top-center" richColors closeButton />
      </body>
    </html>
  );
}
