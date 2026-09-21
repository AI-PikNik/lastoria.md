import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo";
import { StaticPage } from "@/components/public/static-page";
import { getSettings } from "@/lib/settings";

export const metadata: Metadata = buildMetadata({
  title: "Контакты",
  description: "Контакты пиццерии La Storia в Кишинёве: адрес, телефон, часы работы.",
  path: "/contacts",
});

export default async function ContactsPage() {
  const settings = await getSettings();

  return (
    <StaticPage title="Контакты">
      <p>
        Телефон:{" "}
        <a href={`tel:${settings.restaurantPhone.replace(/\s/g, "")}`} className="text-primary underline">
          {settings.restaurantPhone}
        </a>
      </p>
      {settings.restaurantEmail && (
        <p>
          Email:{" "}
          <a href={`mailto:${settings.restaurantEmail}`} className="text-primary underline">
            {settings.restaurantEmail}
          </a>
        </p>
      )}
      <p>Адрес: {settings.restaurantAddress}</p>
      <p>Часы работы: {settings.workingHours}</p>
    </StaticPage>
  );
}
