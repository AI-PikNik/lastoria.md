"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { togglePromoActive } from "@/lib/actions/promos";

export function PromoToggle({ id, isActive }: { id: string; isActive: boolean }) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);

  const handleChange = async (checked: boolean) => {
    setPending(true);
    const result = await togglePromoActive(id, checked);
    setPending(false);
    if (!result.ok) {
      toast.error(result.error ?? "Не удалось изменить статус");
      return;
    }
    router.refresh();
  };

  return (
    <Switch checked={isActive} onCheckedChange={handleChange} disabled={pending} aria-label="Активно" />
  );
}
