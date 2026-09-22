"use client";

import * as React from "react";
import Image from "next/image";
import { toast } from "sonner";
import { ImagePlus, Loader2, X } from "lucide-react";
import { uploadProductImages } from "@/lib/actions/products";
import { Button } from "@/components/ui/button";

/** Одно изображение: загрузка сразу при выборе файла, возвращает ссылку */
export function ImageUploadField({
  value,
  onChange,
  folder = "products",
  label = "Изображение",
}: {
  value: string | null;
  onChange: (url: string | null) => void;
  folder?: "products" | "categories";
  label?: string;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [pending, setPending] = React.useState(false);

  const upload = async (file: File) => {
    setPending(true);
    const formData = new FormData();
    formData.append("files", file);
    formData.append("folder", folder);
    const result = await uploadProductImages(formData);
    setPending(false);
    if (!result.ok || !result.urls?.[0]) {
      toast.error(result.error ?? "Не удалось загрузить файл");
      return;
    }
    onChange(result.urls[0]);
  };

  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold">{label}</p>
      <div className="flex items-center gap-3">
        <div className="relative size-20 overflow-hidden rounded-md border border-border bg-muted">
          {value && <Image src={value} alt="" fill sizes="80px" className="object-cover" />}
        </div>
        <div className="flex flex-col gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()} disabled={pending}>
            {pending ? <Loader2 className="animate-spin" /> : <ImagePlus />}
            {value ? "Заменить" : "Загрузить"}
          </Button>
          {value && (
            <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)}>
              <X /> Убрать
            </Button>
          )}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void upload(file);
            e.target.value = "";
          }}
        />
      </div>
    </div>
  );
}
