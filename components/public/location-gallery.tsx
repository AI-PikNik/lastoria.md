"use client";

import * as React from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

interface GalleryImage {
  id: string;
  url: string;
  caption: string;
}

/** Галерея заведения: сетка миниатюр, по клику — фото на весь экран с листанием (стрелки, свайп) */
export function LocationGallery({
  images,
  title,
  labels,
}: {
  images: GalleryImage[];
  title: string;
  labels: { photo: string; close: string; prev: string; next: string };
}) {
  const [open, setOpen] = React.useState<number | null>(null);
  const touchX = React.useRef<number | null>(null);
  const total = images.length;
  const go = React.useCallback((delta: number) => setOpen((i) => (i === null ? i : (i + delta + total) % total)), [total]);

  React.useEffect(() => {
    if (open === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, go]);

  const current = open !== null ? images[open] : null;
  const counter = (n: number) => labels.photo.replace("{n}", String(n)).replace("{total}", String(total));

  return (
    <>
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3">
        {images.map((image, index) => (
          <li key={image.id}>
            <button
              type="button"
              onClick={() => setOpen(index)}
              className="group relative block aspect-[4/3] w-full overflow-hidden rounded-lg bg-surface gold-frame"
              aria-label={image.caption || counter(index + 1)}
            >
              <Image
                src={image.url}
                alt={image.caption || `${title} — ${counter(index + 1)}`}
                fill
                sizes="(max-width: 639px) 50vw, 260px"
                className="object-cover transition-transform duration-300 group-hover:scale-[1.04]"
              />
            </button>
          </li>
        ))}
      </ul>

      <Dialog open={current !== null} onOpenChange={(value) => !value && setOpen(null)}>
        <DialogContent hideClose className="max-w-5xl border-0 bg-charcoal p-0 text-cream">
          {current && (
            <figure
              className="relative"
              onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
              onTouchEnd={(e) => {
                if (touchX.current === null) return;
                const dx = e.changedTouches[0].clientX - touchX.current;
                if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
                touchX.current = null;
              }}
            >
              <DialogTitle className="sr-only">{current.caption || title}</DialogTitle>
              <div className="relative h-[70vh] w-full">
                <Image src={current.url} alt={current.caption || title} fill sizes="100vw" className="object-contain" />
              </div>
              <figcaption className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                <span>{current.caption}</span>
                <span className="shrink-0 opacity-80">{counter((open ?? 0) + 1)}</span>
              </figcaption>
              <button
                type="button"
                onClick={() => setOpen(null)}
                className="absolute right-2 top-2 flex size-11 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70"
                aria-label={labels.close}
              >
                <X className="size-6" />
              </button>
              {total > 1 && (
                <>
                  <button
                    type="button"
                    onClick={() => go(-1)}
                    className="absolute left-2 top-[35vh] flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70"
                    aria-label={labels.prev}
                  >
                    <ChevronLeft className="size-7" />
                  </button>
                  <button
                    type="button"
                    onClick={() => go(1)}
                    className="absolute right-2 top-[35vh] flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70"
                    aria-label={labels.next}
                  >
                    <ChevronRight className="size-7" />
                  </button>
                </>
              )}
            </figure>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
