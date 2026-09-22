import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

function siteHost(): string | undefined {
  try {
    return new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").host;
  } catch {
    return undefined;
  }
}

const nextConfig: NextConfig = {
  images: {
    dangerouslyAllowSVG: true,
    contentDispositionType: "inline",
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    remotePatterns: [],
  },
  experimental: {
    // 404 для адресов вне языковых разделов (app/global-not-found.tsx)
    globalNotFound: true,
    serverActions: {
      // Загрузка фото товара, логотипа, favicon — поднимаем лимит тела запроса.
      bodySizeLimit: "20mb",
      // За обратным прокси (Nginx в aaPanel) добавляем публичный домен сайта
      // в доверенные источники Server Actions на случай, если прокси не
      // прокидывает x-forwarded-host — см. README, раздел про aaPanel.
      allowedOrigins: siteHost() ? [siteHost()!] : undefined,
    },
  },
  async headers() {
    return [
      {
        // Отключаем буферизацию ответов на стороне Nginx, чтобы стриминг
        // App Router (Suspense/loading.tsx) работал за обратным прокси.
        source: "/:path*{/}?",
        headers: [{ key: "X-Accel-Buffering", value: "no" }],
      },
      {
        // Загруженные файлы (в т.ч. SVG-логотип) не могут выполнять скрипты
        source: "/uploads/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Content-Security-Policy", value: "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; sandbox" },
        ],
      },
    ];
  },
};

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

export default withNextIntl(nextConfig);
