import Link from "next/link";
import { Plus } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { formatMoney } from "@/lib/format";
import { PRODUCT_TYPE_LABELS } from "@/lib/constants";
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
import { ProductRowActions } from "@/components/admin/product-row-actions";

export default async function AdminProductsPage() {
  const products = await prisma.product.findMany({
    orderBy: [{ categoryId: "asc" }, { sortOrder: "asc" }],
    include: { category: true },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold">Товары</h1>
        <Button asChild>
          <Link href="/admin/products/new">
            <Plus className="h-4 w-4" /> Новый товар
          </Link>
        </Button>
      </div>

      <div className="rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Товар</TableHead>
              <TableHead>Категория</TableHead>
              <TableHead>Тип</TableHead>
              <TableHead>Цена</TableHead>
              <TableHead>Статус</TableHead>
              <TableHead className="text-right">Действия</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.map((product) => (
              <TableRow key={product.id}>
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    {product.name}
                    {product.isFeatured && <Badge variant="accent">Хит</Badge>}
                    {product.isAlcohol && <Badge variant="dark">18+</Badge>}
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">{product.category.name}</TableCell>
                <TableCell>{PRODUCT_TYPE_LABELS[product.type]}</TableCell>
                <TableCell>
                  {formatMoney(product.price)}
                  {product.oldPrice && (
                    <span className="ml-2 text-xs text-muted-foreground line-through">
                      {formatMoney(product.oldPrice)}
                    </span>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant={product.isActive ? "success" : "outline"}>
                    {product.isActive ? "Активен" : "Скрыт"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <ProductRowActions
                    id={product.id}
                    name={product.name}
                    isActive={product.isActive}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
