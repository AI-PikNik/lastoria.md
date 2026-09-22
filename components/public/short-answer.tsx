import { cn } from "@/lib/utils";

/**
 * «Короткий ответ» 40–80 слов: сжатое описание страницы в начале контента.
 * Помогает людям и AI-поиску (ChatGPT, Perplexity, Google AI Overviews)
 * получить точный ответ без выдумок — текст собирается из реальных данных.
 */
export function ShortAnswer({ title, text, className }: { title: string; text: string; className?: string }) {
  return (
    <aside
      aria-label={title}
      className={cn("mt-8 rounded-xl border border-border-strong/70 bg-card/70 px-5 py-4 text-[0.98rem]", className)}
      data-short-answer=""
    >
      <p className="font-accent text-lg font-semibold italic text-olive">{title}</p>
      <p className="mt-1 text-foreground/90">{text}</p>
    </aside>
  );
}
