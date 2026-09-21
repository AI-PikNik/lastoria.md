"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { DeleteButton } from "@/components/admin/delete-button";
import { toggleProductActive, deleteProduct } from "@/lib/actions/products";

export function ProductRowActions({
  id,
  name,
  isActive,
}: {
  id: string;
  name: string;
  isActive: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);

  const handleToggle = async (checked: boolean) => {
    setPending(true);
    const result = await toggleProductActive(id, checked);
    setPending(false);
    if (!result.ok) {
      toast.error(result.error ?? "Не удалось изменить статус");
      return;
    }
    router.refresh();
  };

  return (
    <div className="flex items-center justify-end gap-2">
      <Switch checked={isActive} onCheckedChange={handleToggle} disabled={pending} aria-label="Активен" />
      <Button asChild variant="outline" size="sm">
        <Link href={`/admin/products/${id}`}>Изменить</Link>
      </Button>
      <DeleteButton action={deleteProduct.bind(null, id)} confirmText={`Удалить товар «${name}»?`} />
    </div>
  );
}
