import { listMediaFiles } from "@/lib/actions/media";
import { MediaGrid } from "@/components/admin/media-grid";

export default async function AdminMediaPage() {
  const files = await listMediaFiles();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Медиатека</h1>
        <p className="text-sm text-muted-foreground">
          Изображения, загруженные через редактор товаров ({files.length} файлов).
        </p>
      </div>
      <MediaGrid files={files} />
    </div>
  );
}
