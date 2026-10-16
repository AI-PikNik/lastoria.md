import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { toLocalized } from "@/lib/admin-forms";
import { FaqManager, type FaqRow } from "@/components/admin/faq-manager";

export const metadata = { title: "Вопросы и ответы" };

export default async function AdminFaqPage() {
  const rows = await prisma.faqItem.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] });
  const items: FaqRow[] = rows.map((r) => ({
    id: r.id,
    question: toLocalized(r.question),
    answer: toLocalized(r.answer),
    isActive: r.isActive,
  }));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-2xl font-bold">Вопросы и ответы</h1>
        <p className="text-sm text-muted-foreground">
          Блок «Частые вопросы» внизу страницы{" "}
          <Link href="/ru/delivery" target="_blank" className="text-primary underline-offset-4 hover:underline">
            «Доставка и оплата»
          </Link>{" "}
          и разметка FAQ для Google. Добавляйте, скрывайте (переключатель «На сайте») и удаляйте вопросы; порядок —
          перетаскиванием или стрелками.
        </p>
      </div>
      <FaqManager items={items} />
    </div>
  );
}
