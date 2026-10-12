"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { popPreviousAdminUrl } from "./nav-history";

/** «Назад»: на предыдущую страницу админки с теми же фильтрами, иначе — на fallback */
export function BackButton({ fallback, label = "Назад" }: { fallback: string; label?: string }) {
  const router = useRouter();
  return (
    <Button type="button" variant="outline" size="sm" onClick={() => router.push(popPreviousAdminUrl() ?? fallback)}>
      <ArrowLeft /> {label}
    </Button>
  );
}
