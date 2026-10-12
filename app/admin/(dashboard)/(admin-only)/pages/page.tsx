import Link from "next/link";
import { FileText } from "lucide-react";
import { PAGE_TEXT_GROUPS } from "@/lib/page-texts";

export const metadata = { title: "Тексты страниц" };

export default function AdminPagesList() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-2xl font-bold">Тексты страниц</h1>
        <p className="text-sm text-muted-foreground">
          Выберите страницу — откроется форма со всеми её текстами на 4 языках. Цены, адрес, телефон, часы работы и
          районы доставки меняются в «Настройках» и «Доставке», товары — в «Товарах».
        </p>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {PAGE_TEXT_GROUPS.map((group) => (
          <li key={group.id}>
            <Link
              href={`/admin/pages/${group.id}`}
              className="flex h-full gap-3 rounded-xl border border-border bg-card p-4 hover:border-primary/50 hover:shadow-sm"
            >
              <FileText className="mt-0.5 size-5 shrink-0 text-primary" />
              <span>
                <span className="block font-semibold">{group.title}</span>
                <span className="block text-sm text-muted-foreground">
                  {group.description || `Страница ${group.url}`} · полей: {group.fields.length}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
