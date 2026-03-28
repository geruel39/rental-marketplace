"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { createCategory, updateCategory } from "@/actions/admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { slugify } from "@/lib/utils";
import type { Category } from "@/types";

type AdminCategoryFormProps = {
  category?: Category;
  categories?: Category[];
  onComplete?: () => void;
};

export function AdminCategoryForm({
  category,
  categories = [],
  onComplete,
}: AdminCategoryFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState(category?.name ?? "");
  const [slug, setSlug] = useState(category?.slug ?? "");
  const [icon, setIcon] = useState(category?.icon ?? "");
  const [description, setDescription] = useState(category?.description ?? "");
  const [parentId, setParentId] = useState(category?.parent_id ?? "none");
  const [sortOrder, setSortOrder] = useState(category?.sort_order ?? 0);
  const [isActive, setIsActive] = useState(category?.is_active ?? true);

  function handleSubmit() {
    startTransition(async () => {
      if (category) {
        await updateCategory(category.id, {
          name,
          slug,
          icon: icon || null,
          description: description || null,
          parent_id: parentId === "none" ? null : parentId,
          sort_order: sortOrder,
          is_active: isActive,
        });
      } else {
        await createCategory({
          name,
          slug,
          icon: icon || null,
          description: description || null,
          parentId: parentId === "none" ? null : parentId,
          sortOrder,
        });
      }

      router.refresh();
      onComplete?.();
    });
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="category-name">Name</Label>
          <Input
            id="category-name"
            onChange={(event) => {
              const nextName = event.target.value;
              setName(nextName);
              if (!category) {
                setSlug(slugify(nextName));
              }
            }}
            value={name}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="category-slug">Slug</Label>
          <Input
            id="category-slug"
            onChange={(event) => setSlug(slugify(event.target.value))}
            value={slug}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="category-icon">Icon</Label>
          <Input
            id="category-icon"
            onChange={(event) => setIcon(event.target.value)}
            placeholder="📦"
            value={icon}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="category-parent">Parent Category</Label>
          <Select onValueChange={setParentId} value={parentId}>
            <SelectTrigger id="category-parent">
              <SelectValue placeholder="Select parent category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No parent</SelectItem>
              {categories
                .filter((item) => item.id !== category?.id)
                .map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="category-description">Description</Label>
        <Textarea
          id="category-description"
          onChange={(event) => setDescription(event.target.value)}
          rows={4}
          value={description}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="category-sort-order">Sort Order</Label>
          <Input
            id="category-sort-order"
            onChange={(event) => setSortOrder(Number(event.target.value) || 0)}
            type="number"
            value={sortOrder}
          />
        </div>
        <div className="flex items-end gap-3">
          <Switch checked={isActive} id="category-active" onCheckedChange={setIsActive} />
          <Label htmlFor="category-active">Active category</Label>
        </div>
      </div>

      <div className="flex justify-end">
        <Button disabled={isPending || !name.trim() || !slug.trim()} onClick={handleSubmit}>
          {isPending
            ? category
              ? "Updating..."
              : "Creating..."
            : category
              ? "Update Category"
              : "Create Category"}
        </Button>
      </div>
    </div>
  );
}
