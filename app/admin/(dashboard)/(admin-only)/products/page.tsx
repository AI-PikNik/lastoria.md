import Image from "next/image";
import Link from "next/link";
import { Plus } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { formatMoney } from "@/lib/format";
import { missingLocales } from "@/lib/i18n/translate";
import { adminName, getCategoryOptions } from "@/lib/admin-data";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ProductRowActions } from "@/components/admin/product-row-actions";
import { MissingBadge } from "@/components/admin/localized-fields";
import { cn } from "@/lib/utils";
import type { Prisma } from "@/lib/generated/prisma/client";

export const metadata = { title: "Товары" };

export default async function AdminProductsPage({ searchParams }: PageProps<"/admin/products">) {
  const params = await searchParams;
  const group = typeof params.group === "string" ? params.group : "";
  const q = typeof params.q === "string" ? params.q.trim() : "";
  const missingOnly = params.missing === "1";

  const where: Prisma.ProductWhereInput = {};
  if (group) where.categoryId = group;
  if (q) {
    where.OR = [
      { slug: { contains: q, mode: "insensitive" } },
      { sku: { contains: q, mode: "insensitive" } },
      { translations: { some: { name: { contains: q, mode: "insensitive" } } } },
    ];
  }

  const [rows, categories] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy: [{ category: { sortOrder: "asc" } }, { sortOrder: "asc" }],
      include: { category: { include: { translations: true } }, translations: true },
    }),
    getCategoryOptions(),
  ]);
  const products = rows
    .map((p) => ({ ...p, missing: missingLocales(p.translations, "name") }))
    .filter((p) => !missingOnly || p.missing.length > 0);

  const filterHref = (patch: Record<string, string>) => {
    const next = new URLSearchParams({ ...(group && { group }), ...(q && { q }), ...(missingOnly && { missing: "1" }), ...patch });
    for (const [k, v] of [...next.entries()]) if (!v) next.delete(k);
    return `/admin/products?${next.toString()}`;
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold">Товары</h1>
        <Button asChild>
          <Link href="/admin/products/new">
            <Plus /> Новый товар
          </Link>
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Link
          href={filterHref({ group: "" })}
          className={cn("rounded-full border px-3 py-1.5 text-sm", !group ? "border-primary bg-primary text-primary-foreground" : "bg-card")}
        >
          Все группы
        </Link>
        {categories.map((c) => (
          <Link
            key={c.id}
            href={filterHref({ group: c.id })}
            className={cn("rounded-full border px-3 py-1.5 text-sm", group === c.id ? "border-primary bg-primary text-primary-foreground" : "bg-card")}
          >
            {c.name}
            {!c.isActive && " (скрыта)"}
          </Link>
        ))}
        <Link
          href={filterHref({ missing: missingOnly ? "" : "1" })}
          className={cn("rounded-full border px-3 py-1.5 text-sm", missingOnly ? "border-amber-400 bg-amber-100" : "bg-card")}
        >
          Только без перевода
        </Link>
        <form action="/admin/products" className="ml-auto flex gap-2">
          {group && <input type="hidden" name="group" value={group} />}
          <input
            name="q"
            defaultValue={q}
            placeholder="Поиск по названию, slug, SKU"
            className="h-9 w-56 rounded-md border border-input bg-card px-3 text-sm"
          />
          <Button type="submit" size="sm" variant="outline">
            Найти
          </Button>
        </form>
      </div>

      <div className="rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Товар</TableHead>
              <TableHead>Группа</TableHead>
              <TableHead>Цена</TableHead>
              <TableHead>Статус</TableHead>
              <TableHead className="text-right">Действия</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.map((product) => {
              const name = adminName(product.translations, product.slug);
              return (
                <TableRow key={product.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="relative size-10 shrink-0 overflow-hidden rounded bg-muted">
                        {product.imageUrl && <Image src={product.imageUrl} alt="" fill sizes="40px" className="object-cover" />}
                      </div>
                      <div>
                        <Link href={`/admin/products/${product.id}`} className="flex flex-wrap items-center gap-2 font-medium hover:underline">
                          {name}
                          {product.isFeatured && <Badge variant="hit">Хит</Badge>}
                          {(product.isAlcohol || product.category.requiresAgeConfirm) && <Badge variant="dark">18+</Badge>}
                        </Link>
                        {product.missing.length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {product.missing.map((l) => (
                              <MissingBadge key={l} locale={l} />
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{adminName(product.category.translations, product.category.slug)}</TableCell>
                  <TableCell>
                    {formatMoney(product.price, "admin")}
                    {product.oldPrice && (
                      <span className="ml-2 text-xs text-muted-foreground line-through">{formatMoney(product.oldPrice, "admin")}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={product.isActive ? "success" : "outline"}>{product.isActive ? "На сайте" : "Скрыт"}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <ProductRowActions id={product.id} name={name} isActive={product.isActive} />
                  </TableCell>
                </TableRow>
              );
            })}
            {products.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                  Товары не найдены
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
