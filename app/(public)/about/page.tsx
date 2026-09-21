import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo";
import { StaticPage } from "@/components/public/static-page";

export const metadata: Metadata = buildMetadata({
  title: "О нас",
  description: "La Storia — пиццерия в Кишинёве. История бренда, ценности и подход к качеству.",
  path: "/about",
});

export default function AboutPage() {
  return (
    <StaticPage title="О нас">
      <p>
        La Storia — пиццерия в Кишинёве, где пиццу готовят из свежего теста и
        качественных ингредиентов. Мы работаем над тем, чтобы каждый заказ был
        приготовлен быстро и вкусно — для доставки на дом или самовывоза.
      </p>
      <p>
        Наше меню включает классическую и авторскую пиццу, напитки, алкоголь для
        совершеннолетних гостей и закуски к любому поводу.
      </p>
    </StaticPage>
  );
}
