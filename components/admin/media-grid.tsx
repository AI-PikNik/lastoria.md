"use client";

import * as React from "react";
import { toast } from "sonner";
import { Copy, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { deleteMediaFile, type MediaFile } from "@/lib/actions/media";

export function MediaGrid({ files }: { files: MediaFile[] }) {
  const [items, setItems] = React.useState(files);

  const copyUrl = async (url: string) => {
    try {
      await navigator.clipboard.writeText(window.location.origin + url);
      toast.success("Ссылка скопирована");
    } catch {
      toast.error("Не удалось скопировать");
    }
  };

  const remove = async (key: string) => {
    if (!window.confirm("Удалить файл?")) return;
    const result = await deleteMediaFile(key);
    if (!result.ok) {
      toast.error(result.error ?? "Не удалось удалить");
      return;
    }
    setItems((prev) => prev.filter((f) => f.key !== key));
    toast.success("Файл удалён");
  };

  if (items.length === 0) {
    return <p className="text-muted-foreground">Загруженных файлов пока нет.</p>;
  }

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-6">
      {items.map((file) => (
        <div key={file.key} className="overflow-hidden rounded-lg border border-border bg-card">
          <div className="relative aspect-square bg-muted">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={file.url} alt={file.key} className="h-full w-full object-cover" />
          </div>
          <div className="flex items-center justify-between p-2">
            <span className="truncate text-xs text-muted-foreground" title={file.key}>
              {file.key.split("/").pop()}
            </span>
            <div className="flex gap-1">
              <Button variant="ghost" size="icon" onClick={() => copyUrl(file.url)} aria-label="Скопировать ссылку">
                <Copy className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => remove(file.key)} aria-label="Удалить">
                <Trash2 className="h-3.5 w-3.5 text-destructive" />
              </Button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
