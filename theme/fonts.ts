/**
 * ШРИФТЫ ТЕМЫ
 * Чтобы сменить шрифт сайта — поменяйте импорт здесь; остальной код
 * использует только CSS-переменные --ff-display / --ff-accent / --ff-body.
 */
import { Cormorant_Garamond, Playfair_Display, Source_Sans_3 } from "next/font/google";

/** Заголовки и логотип — выразительная антиква, как на вывеске постера */
export const displayFont = Playfair_Display({
  variable: "--ff-display",
  subsets: ["latin", "latin-ext", "cyrillic"],
  style: ["normal", "italic"],
  display: "swap",
});

/** Подзаголовки и слоганы — курсивная антиква ("Pizzeria tradizionale italiana") */
export const accentFont = Cormorant_Garamond({
  variable: "--ff-accent",
  subsets: ["latin", "latin-ext", "cyrillic"],
  weight: ["500", "600", "700"],
  style: ["normal", "italic"],
  display: "swap",
});

/** Основной текст — гуманистический гротеск, хорошо читается на телефоне */
export const bodyFont = Source_Sans_3({
  variable: "--ff-body",
  subsets: ["latin", "latin-ext", "cyrillic"],
  display: "swap",
});

export const fontVariables = `${displayFont.variable} ${accentFont.variable} ${bodyFont.variable}`;
