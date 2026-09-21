import type { ReactNode } from "react";

export function StaticPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="font-display text-3xl font-bold">{title}</h1>
      <div className="prose-content mt-6 space-y-4 text-sm leading-relaxed text-foreground">
        {children}
      </div>
    </div>
  );
}
