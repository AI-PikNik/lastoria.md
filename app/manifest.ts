import type { MetadataRoute } from "next";
import { getSettings } from "@/lib/settings";
import { pickLocalized } from "@/lib/i18n/translate";

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const settings = await getSettings();
  const icon = settings.faviconUrl;
  return {
    name: `${settings.restaurantName} — Pizzeria tradizionale italiana`,
    short_name: settings.restaurantName,
    description: pickLocalized(settings.seoDescriptions, "ro") || "Pizzeria La Storia, Chișinău",
    start_url: "/",
    display: "standalone",
    lang: "ro",
    background_color: "#f6ebd8",
    theme_color: "#7a1f1f",
    icons: icon
      ? [{ src: icon, sizes: "any" }]
      : [
          { src: "/icon", sizes: "512x512", type: "image/png" },
          { src: "/apple-icon", sizes: "180x180", type: "image/png" },
        ],
  };
}
