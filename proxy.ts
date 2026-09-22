import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { routing } from "./i18n/routing";

const intlMiddleware = createMiddleware(routing);

const PREFIXED_LOCALES = routing.locales.filter((l) => l !== routing.defaultLocale);

export default function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasPrefix = routing.locales.some(
    (l) => pathname === `/${l}` || pathname.startsWith(`/${l}/`)
  );
  const fetchDest = request.headers.get("sec-fetch-dest");
  const isDocumentGet = request.method === "GET" && (fetchDest === null || fetchDest === "document");

  // Вернувшегося посетителя с сохранённым языком (cookie ставит переключатель
  // языка) отправляем на его версию. Без cookie `/` всегда румынская — поисковые
  // роботы cookie не присылают, так что индексация не страдает.
  if (!hasPrefix && isDocumentGet) {
    const saved = request.cookies.get("NEXT_LOCALE")?.value;
    if (saved && (PREFIXED_LOCALES as readonly string[]).includes(saved)) {
      const url = request.nextUrl.clone();
      url.pathname = `/${saved}${pathname === "/" ? "" : pathname}`;
      return NextResponse.redirect(url);
    }
  }

  return intlMiddleware(request);
}

export const config = {
  // Всё, кроме админки, API, служебных файлов Next.js, загрузок и файлов с точкой
  // (sitemap.xml, robots.txt, llms.txt, manifest.webmanifest, картинки)
  matcher: ["/((?!api|admin|_next|_vercel|uploads|brand|.*\\..*).*)"],
};
