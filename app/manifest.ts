import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "La Storia — пиццерия",
    short_name: "La Storia",
    description: "Пицца, напитки и десерты с доставкой по Кишинёву или самовывозом.",
    start_url: "/",
    display: "standalone",
    background_color: "#fdf6ec",
    theme_color: "#c8391f",
    icons: [
      { src: "/icon", sizes: "512x512", type: "image/png" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}
