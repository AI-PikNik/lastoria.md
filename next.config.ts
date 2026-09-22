import type { NextConfig } from "next";

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
    serverActions: {
      // Редактор товара может отправлять главное фото + несколько фото галереи
      // (до 5 МБ каждое) одним запросом Server Action — поднимаем лимит тела запроса.
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
    ];
  },
};

export default nextConfig;
