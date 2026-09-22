"use client";

import * as React from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

export function ProductGallery({ images, alt }: { images: string[]; alt: string }) {
  const [active, setActive] = React.useState(0);
  const current = images[active];

  return (
    <div>
      <div className="relative aspect-square overflow-hidden rounded-xl bg-surface gold-frame shadow-card sm:aspect-[4/3] lg:aspect-square">
        {current ? (
          <Image
            src={current}
            alt={alt}
            fill
            priority
            sizes="(max-width: 1023px) 100vw, 520px"
            className="object-cover"
          />
        ) : (
          <span className="flex h-full items-center justify-center font-display text-5xl italic text-gold">La Storia</span>
        )}
      </div>
      {images.length > 1 && (
        <ul className="no-scrollbar mt-3 flex gap-2 overflow-x-auto">
          {images.map((url, index) => (
            <li key={url}>
              <button
                type="button"
                onClick={() => setActive(index)}
                aria-label={`${alt} — ${index + 1}/${images.length}`}
                aria-pressed={index === active}
                className={cn(
                  "relative block size-16 overflow-hidden rounded-md border-2 sm:size-20",
                  index === active ? "border-primary" : "border-transparent opacity-80 hover:opacity-100"
                )}
              >
                <Image src={url} alt="" fill sizes="80px" className="object-cover" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
