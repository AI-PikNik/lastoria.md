import { Plus } from "lucide-react";
import { prisma } from "@/lib/prisma";
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
import { CategoryFormDialog } from "@/components/admin/category-form-dialog";
import { DeleteButton } from "@/components/admin/delete-button";
import { deleteCategory } from "@/lib/actions/categories";

export default async function AdminCategoriesPage() {
  const categories = await prisma.category.findMany({
    orderBy: { sortOrder: "asc" },
    include: { _count: { select: { products: true } } },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold">Категории</h1>
        <CategoryFormDialog
          trigger={
            <Button>
              <Plus className="h-4 w-4" /> Новая категория
            </Button>
          }
        />
      </div>

      <div className="rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Название</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead>Товаров</TableHead>
              <TableHead>Порядок</TableHead>
              <TableHead>Статус</TableHead>
              <TableHead className="text-right">Действия</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {categories.map((category) => (
              <TableRow key={category.id}>
                <TableCell className="font-medium">{category.name}</TableCell>
                <TableCell className="text-muted-foreground">{category.slug}</TableCell>
                <TableCell>{category._count.products}</TableCell>
                <TableCell>{category.sortOrder}</TableCell>
                <TableCell>
                  <Badge variant={category.isActive ? "success" : "outline"}>
                    {category.isActive ? "Активна" : "Скрыта"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <CategoryFormDialog
                      category={category}
                      trigger={
                        <Button variant="outline" size="sm">
                          Изменить
                        </Button>
                      }
                    />
                    <DeleteButton
                      action={deleteCategory.bind(null, category.id)}
                      confirmText={`Удалить категорию «${category.name}»?`}
                    />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
