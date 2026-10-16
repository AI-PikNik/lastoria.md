import { BUILD_INFO, CURRENT_RELEASE, RELEASES } from "@/lib/releases";
import { formatDateTime } from "@/lib/format";
import { Badge } from "@/components/ui/badge";

export const metadata = { title: "Версия" };

const formatDate = (iso: string) => iso.split("-").reverse().join(".");

export default function AdminVersionPage() {
  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Версия сайта: {CURRENT_RELEASE.version}</h1>
        <p className="text-sm text-muted-foreground">
          Нумерация 0.Y.Z: Y растёт с каждой партией новых возможностей, Z — с исправлениями.
          {BUILD_INFO.commit && (
            <>
              {" "}
              Сборка: коммит <code className="rounded bg-muted px-1">{BUILD_INFO.commit}</code>
              {BUILD_INFO.time && <> от {formatDateTime(new Date(BUILD_INFO.time))}</>}.
            </>
          )}
        </p>
      </div>
      <ol className="space-y-4">
        {RELEASES.map((release, index) => (
          <li key={release.version} className="rounded-xl border border-border bg-card p-4">
            <p className="flex flex-wrap items-center gap-2">
              <span className="font-display text-lg font-bold">ver: {release.version}</span>
              <span className="text-sm text-muted-foreground">{formatDate(release.date)}</span>
              {index === 0 && <Badge>текущая</Badge>}
            </p>
            <p className="font-medium">{release.title}</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
              {release.changes.map((change) => (
                <li key={change}>{change}</li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
    </div>
  );
}
