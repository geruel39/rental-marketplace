"use client";

import { useState, useTransition } from "react";
import { ArrowDown, ArrowUp, Pencil, Plus } from "lucide-react";
import { useRouter } from "next/navigation";

import { toggleCategoryActive, updateCategory } from "@/actions/admin";
import { AdminCategoryForm } from "@/components/admin/admin-category-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Category } from "@/types";

type CategoryRow = Category & {
  listingsCount: number;
};

export function AdminCategoryTable({ categories }: { categories: CategoryRow[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [createOpen, setCreateOpen] = useState(false);

  function moveCategory(category: CategoryRow, direction: "up" | "down") {
    const adjacent = categories.find((item) =>
      direction === "up"
        ? item.sort_order < category.sort_order
        : item.sort_order > category.sort_order,
    );

    if (!adjacent) {
      return;
    }

    startTransition(async () => {
      await Promise.all([
        updateCategory(category.id, { sort_order: adjacent.sort_order }),
        updateCategory(adjacent.id, { sort_order: category.sort_order }),
      ]);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog onOpenChange={setCreateOpen} open={createOpen}>
          <DialogTrigger asChild>
            <Button className="bg-brand-navy text-white hover:bg-brand-steel">
              <Plus className="size-4" />
              Add Category
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Category</DialogTitle>
              <DialogDescription>Create a new category for marketplace listings.</DialogDescription>
            </DialogHeader>
            <AdminCategoryForm
              categories={categories}
              onComplete={() => setCreateOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-3xl border border-border/70 bg-white shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Icon</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead>Listings Count</TableHead>
              <TableHead>Sort Order</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {categories.map((category) => (
              <TableRow key={category.id}>
                <TableCell>{category.icon || "—"}</TableCell>
                <TableCell className="font-medium text-foreground">{category.name}</TableCell>
                <TableCell>{category.slug}</TableCell>
                <TableCell>{category.listingsCount}</TableCell>
                <TableCell>{category.sort_order}</TableCell>
                <TableCell>
                  <Badge
                    className={
                      category.is_active
                        ? "bg-emerald-600 text-white hover:bg-emerald-600"
                        : "bg-muted text-foreground hover:bg-muted"
                    }
                  >
                    {category.is_active ? "Active" : "Inactive"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button size="icon-sm" variant="outline">
                          <Pencil className="size-4" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Edit Category</DialogTitle>
                          <DialogDescription>
                            Update category details, parent grouping, and display order.
                          </DialogDescription>
                        </DialogHeader>
                        <AdminCategoryForm category={category} categories={categories} />
                      </DialogContent>
                    </Dialog>

                    <Button
                      disabled={isPending}
                      onClick={() =>
                        startTransition(async () => {
                          await toggleCategoryActive(category.id);
                          router.refresh();
                        })
                      }
                      size="sm"
                      variant="outline"
                    >
                      {category.is_active ? "Disable" : "Enable"}
                    </Button>

                    <Button
                      disabled={isPending}
                      onClick={() => moveCategory(category, "up")}
                      size="icon-sm"
                      variant="outline"
                    >
                      <ArrowUp className="size-4" />
                    </Button>
                    <Button
                      disabled={isPending}
                      onClick={() => moveCategory(category, "down")}
                      size="icon-sm"
                      variant="outline"
                    >
                      <ArrowDown className="size-4" />
                    </Button>
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

