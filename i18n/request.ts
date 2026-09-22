import { getRequestConfig } from "next-intl/server";
import { hasLocale } from "next-intl";
import { routing } from "./routing";
import { getMessagesFor } from "@/lib/i18n/messages";

export default getRequestConfig(async ({ requestLocale, locale: explicitLocale }) => {
  const requested = explicitLocale ?? (await requestLocale);
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;

  return {
    locale,
    messages: await getMessagesFor(locale),
    timeZone: "Europe/Chisinau",
  };
});
