import Link from "next/link";
import { Plus } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { formatMoney, formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PromoToggle } from "@/components/admin/promo-toggle";
import { DeleteButton } from "@/components/admin/delete-button";
import { deletePromo } from "@/lib/actions/promos";

const TYPE_LABELS: Record<string, string> = {
  PERCENT: "Процент",
  FIXED: "Фикс. сумма",
  PRODUCT_OVERRIDE: "Спец. цена",
};

const SCOPE_LABELS: Record<string, string> = {
  PRODUCT: "Товар",
  CATEGORY: "Категория",
  PRODUCT_TYPE: "Тип товара",
  CART: "Корзина",
};

export default async function AdminPromosPage() {
  const promos = await prisma.promo.findMany({ orderBy: { createdAt: "desc" } });
  const now = new Date();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold">Промо и скидки</h1>
        <Button asChild>
          <Link href="/admin/promos/new">
            <Plus className="h-4 w-4" /> Новое промо
          </Link>
        </Button>
      </div>

      <div className="rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Название</TableHead>
              <TableHead>Тип / область</TableHead>
              <TableHead>Значение</TableHead>
              <TableHead>Период</TableHead>
              <TableHead>Статус</TableHead>
              <TableHead className="text-right">Действия</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {promos.map((promo) => {
              const expired = promo.endsAt < now;
              return (
                <TableRow key={promo.id}>
                  <TableCell className="font-medium">
                    {promo.name}
                    {promo.code && (
                      <div className="text-xs text-muted-foreground">Код: {promo.code}</div>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {TYPE_LABELS[promo.type]} / {SCOPE_LABELS[promo.scope]}
                  </TableCell>
                  <TableCell>
                    {promo.type === "PERCENT" ? `${promo.value}%` : formatMoney(promo.value)}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatDate(promo.startsAt)} — {formatDate(promo.endsAt)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={promo.isActive && !expired ? "success" : "outline"}>
                      {expired ? "Истекло" : promo.isActive ? "Активно" : "Выключено"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end items-center gap-2">
                      <PromoToggle id={promo.id} isActive={promo.isActive} />
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/admin/promos/${promo.id}`}>Изменить</Link>
                      </Button>
                      <DeleteButton
                        action={deletePromo.bind(null, promo.id)}
                        confirmText={`Удалить промо «${promo.name}»?`}
                      />
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
            {promos.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                  Промо ещё не созданы
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
