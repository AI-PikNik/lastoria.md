"use client";

import * as React from "react";
import { ArrowDown, ArrowUp, GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Список с перетаскиванием (мышью) и кнопками ↑/↓ (клавиатура, тач).
 * onReorder получает новый порядок id.
 */
export function SortableList<T extends { id: string }>({
  items,
  onReorder,
  renderItem,
  className,
}: {
  items: T[];
  onReorder: (ids: string[]) => void;
  renderItem: (item: T, index: number) => React.ReactNode;
  className?: string;
}) {
  const [dragId, setDragId] = React.useState<string | null>(null);
  const [overId, setOverId] = React.useState<string | null>(null);

  const move = (from: number, to: number) => {
    if (to < 0 || to >= items.length || from === to) return;
    const ids = items.map((i) => i.id);
    const [moved] = ids.splice(from, 1);
    ids.splice(to, 0, moved);
    onReorder(ids);
  };

  return (
    <ul className={cn("divide-y divide-border", className)}>
      {items.map((item, index) => (
        <li
          key={item.id}
          draggable
          onDragStart={(e) => {
            setDragId(item.id);
            e.dataTransfer.effectAllowed = "move";
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setOverId(item.id);
          }}
          onDragLeave={() => setOverId((id) => (id === item.id ? null : id))}
          onDrop={(e) => {
            e.preventDefault();
            const from = items.findIndex((i) => i.id === dragId);
            if (from >= 0) move(from, index);
            setDragId(null);
            setOverId(null);
          }}
          onDragEnd={() => {
            setDragId(null);
            setOverId(null);
          }}
          className={cn(
            "flex items-center gap-2 bg-card px-2 py-2",
            dragId === item.id && "opacity-50",
            overId === item.id && dragId !== item.id && "ring-2 ring-inset ring-primary/40"
          )}
        >
          <GripVertical className="size-4 shrink-0 cursor-grab text-muted-foreground" aria-hidden="true" />
          <div className="flex flex-col">
            <button
              type="button"
              className="rounded p-0.5 text-muted-foreground hover:bg-muted disabled:opacity-30"
              onClick={() => move(index, index - 1)}
              disabled={index === 0}
              aria-label="Выше"
            >
              <ArrowUp className="size-3.5" />
            </button>
            <button
              type="button"
              className="rounded p-0.5 text-muted-foreground hover:bg-muted disabled:opacity-30"
              onClick={() => move(index, index + 1)}
              disabled={index === items.length - 1}
              aria-label="Ниже"
            >
              <ArrowDown className="size-3.5" />
            </button>
          </div>
          <div className="min-w-0 flex-1">{renderItem(item, index)}</div>
        </li>
      ))}
    </ul>
  );
}
