"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { deleteFaqItem, reorderFaqItems, saveFaqItem, setFaqItemActive } from "@/lib/actions/content";
import { emptyLocalized, type LocalizedValue } from "@/lib/admin-forms";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { LocalizedFields, MissingBadge } from "./localized-fields";
import { SortableList } from "./sortable-list";

export interface FaqRow {
  id: string;
  question: LocalizedValue;
  answer: LocalizedValue;
  isActive: boolean;
}

const pick = (v: LocalizedValue) => v.ru || v.ro || v.en || v.it || "—";

export function FaqManager({ items }: { items: FaqRow[] }) {
  const router = useRouter();
  const [editing, setEditing] = React.useState<FaqRow | "new" | null>(null);

  const run = async (promise: Promise<{ ok: boolean; error?: string; fieldErrors?: Record<string, string> }>, success: string) => {
    const result = await promise;
    if (!result.ok) toast.error(result.error ?? "Ошибка");
    else toast.success(success);
    router.refresh();
    return result;
  };

  return (
    <div className="space-y-4">
      <Button onClick={() => setEditing("new")}>
        <Plus /> Добавить вопрос
      </Button>

      {items.length === 0 ? (
        <p className="rounded-xl border-2 border-dashed border-border-strong p-6 text-center text-sm text-muted-foreground">
          Вопросов пока нет — блок «Частые вопросы» на странице «Доставка» не показывается.
        </p>
      ) : (
        <div className="rounded-xl border border-border bg-card">
          <SortableList
            items={items}
            onReorder={(ids) => run(reorderFaqItems(ids), "Порядок сохранён")}
            renderItem={(item) => (
              <div className="flex flex-wrap items-center gap-3">
                <div className="min-w-48 flex-1">
                  <p className="flex flex-wrap items-center gap-2 font-medium">
                    {pick(item.question)}
                    {!item.isActive && <Badge variant="outline">скрыт</Badge>}
                    {(["ro", "ru", "en", "it"] as const)
                      .filter((l) => !item.question[l] || !item.answer[l])
                      .map((l) => (
                        <MissingBadge key={l} locale={l} />
                      ))}
                  </p>
                  <p className="line-clamp-2 text-sm text-muted-foreground">{pick(item.answer)}</p>
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <Switch
                    checked={item.isActive}
                    onCheckedChange={(on) => run(setFaqItemActive(item.id, on), on ? "Вопрос показан на сайте" : "Вопрос скрыт")}
                    aria-label="Показывать на сайте"
                  />
                  На сайте
                </label>
                <Button variant="outline" size="sm" onClick={() => setEditing(item)}>
                  <Pencil /> Изменить
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() =>
                    window.confirm(`Удалить вопрос «${pick(item.question)}»? Его можно просто скрыть.`) &&
                    run(deleteFaqItem(item.id), "Вопрос удалён")
                  }
                  aria-label="Удалить вопрос"
                >
                  <Trash2 />
                </Button>
              </div>
            )}
          />
        </div>
      )}

      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          {editing !== null && (
            <FaqForm
              item={editing === "new" ? null : editing}
              onSave={async (data) => {
                const result = await run(saveFaqItem(editing === "new" ? null : editing.id, data), "Вопрос сохранён");
                if (result.ok) setEditing(null);
                return result.fieldErrors ?? {};
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FaqForm({
  item,
  onSave,
}: {
  item: FaqRow | null;
  onSave: (data: { question: LocalizedValue; answer: LocalizedValue; isActive: boolean }) => Promise<Record<string, string>>;
}) {
  const [question, setQuestion] = React.useState(item?.question ?? emptyLocalized());
  const [answer, setAnswer] = React.useState(item?.answer ?? emptyLocalized());
  const [isActive, setIsActive] = React.useState(item?.isActive ?? true);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [pending, setPending] = React.useState(false);
  return (
    <div className="space-y-4">
      <DialogHeader>
        <DialogTitle>{item ? "Вопрос и ответ" : "Новый вопрос"}</DialogTitle>
      </DialogHeader>
      <LocalizedFields id="faq-q" label="Вопрос" value={question} onChange={setQuestion} error={errors.question} />
      <LocalizedFields
        id="faq-a"
        label="Ответ"
        value={answer}
        onChange={setAnswer}
        multiline
        rows={4}
        error={errors.answer}
        hint="Можно вставить {min} — минимальный заказ, {address} — адрес, {hours} — часы работы: сайт подставит их из «Настроек»."
      />
      <label className="flex items-center justify-between rounded-lg border border-border p-3 text-sm">
        Показывать на сайте
        <Switch checked={isActive} onCheckedChange={setIsActive} />
      </label>
      <div className="flex justify-end">
        <Button
          disabled={pending}
          onClick={async () => {
            setPending(true);
            setErrors(await onSave({ question, answer, isActive }));
            setPending(false);
          }}
        >
          Сохранить
        </Button>
      </div>
    </div>
  );
}
