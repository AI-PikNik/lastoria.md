import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo";
import { StaticPage } from "@/components/public/static-page";

export const metadata: Metadata = buildMetadata({
  title: "Публичная оферта",
  description: "Условия оформления и выполнения заказов на сайте La Storia.",
  path: "/terms",
});

export default function TermsPage() {
  return (
    <StaticPage title="Публичная оферта">
      <p>
        Оформляя заказ на сайте La Storia, вы соглашаетесь с указанными условиями:
        заказ считается принятым после подтверждения оператором по телефону.
      </p>
      <p>
        Стоимость товаров указана в молдавских леях (MDL) и может включать применённые
        скидки по действующим акциям. Оплата производится наличными или картой курьеру
        при получении заказа.
      </p>
      <p>
        Продажа алкогольной продукции осуществляется только лицам старше 18 лет в
        соответствии с законодательством Республики Молдова.
      </p>
    </StaticPage>
  );
}
