import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo";
import { StaticPage } from "@/components/public/static-page";

export const metadata: Metadata = buildMetadata({
  title: "Продажа алкоголя 18+",
  description: "Условия продажи алкогольной продукции на сайте La Storia лицам старше 18 лет.",
  path: "/age-policy",
});

export default function AgePolicyPage() {
  return (
    <StaticPage title="Продажа алкоголя 18+">
      <p>
        Раздел «Алкоголь» на сайте La Storia доступен только лицам, достигшим 18 лет.
        При переходе в карточку алкогольного товара или добавлении его в корзину вам
        будет предложено подтвердить свой возраст.
      </p>
      <p>
        Оформляя заказ с алкогольной продукцией, вы подтверждаете, что вам исполнилось
        18 лет. Курьер вправе запросить документ, удостоверяющий личность, при передаче
        заказа.
      </p>
    </StaticPage>
  );
}
