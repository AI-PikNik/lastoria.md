import { countWords } from "@/lib/seo";

export interface SeoCheckInput {
  name: string;
  seoTitle: string;
  seoDescription: string;
  shortDescription: string;
  description: string;
  shortAnswer: string;
  imageAlt: string;
  hasImage: boolean;
}

export interface SeoCheck {
  id: string;
  label: string;
  ok: boolean;
  /** true — не ошибка, а совет (есть автоматическая замена) */
  soft?: boolean;
  hint?: string;
}

/** SEO-чеклист товара для одного языка (показывается в админке) */
export function productSeoChecklist(input: SeoCheckInput): SeoCheck[] {
  const title = input.seoTitle.trim();
  const description = input.seoDescription.trim();
  const answerWords = countWords(input.shortAnswer);
  return [
    { id: "name", label: "Название заполнено", ok: input.name.trim().length >= 2 },
    {
      id: "title",
      label: "SEO-заголовок 30–60 символов",
      ok: title.length >= 30 && title.length <= 60,
      soft: !title,
      hint: title ? `сейчас ${title.length}` : "пусто — будет «Название — Группа»",
    },
    {
      id: "description",
      label: "SEO-описание 70–160 символов",
      ok: description.length >= 70 && description.length <= 160,
      soft: !description && input.shortDescription.trim().length > 0,
      hint: description ? `сейчас ${description.length}` : "пусто — возьмётся краткое описание",
    },
    {
      id: "short",
      label: "Краткое описание для карточки",
      ok: input.shortDescription.trim().length > 0,
    },
    {
      id: "text",
      label: "Полное описание не короче 100 символов",
      ok: input.description.trim().length >= 100,
      soft: true,
    },
    {
      id: "answer",
      label: "«Короткий ответ» 40–80 слов",
      ok: answerWords >= 40 && answerWords <= 80,
      soft: answerWords === 0,
      hint: answerWords ? `сейчас ${answerWords} слов` : "пусто — соберётся автоматически из цены и группы",
    },
    { id: "image", label: "Есть главное фото", ok: input.hasImage },
    { id: "alt", label: "Alt-текст фото", ok: input.imageAlt.trim().length > 0, soft: true, hint: "пусто — используется название" },
  ];
}
