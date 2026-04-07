"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Filter } from "lucide-react";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import type { Category } from "@/types";

interface ListingFiltersProps {
  categories: Category[];
  currentFilters: {
    category?: string;
    minPrice?: string;
    maxPrice?: string;
    city?: string;
    condition?: string;
    inStockOnly?: boolean;
  };
}

const conditionOptions = ["New", "Like New", "Good", "Fair"] as const;

function normalizeValue(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function ListingFilters({
  categories,
  currentFilters,
}: ListingFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [minPrice, setMinPrice] = useState(currentFilters.minPrice ?? "");
  const [maxPrice, setMaxPrice] = useState(currentFilters.maxPrice ?? "");
  const [city, setCity] = useState(currentFilters.city ?? "");

  function updateParams(
    updates: Record<string, string | undefined | null | boolean>,
    options?: { resetPage?: boolean },
  ) {
    const nextParams = new URLSearchParams(searchParams.toString());

    Object.entries(updates).forEach(([key, value]) => {
      if (
        value === undefined ||
        value === null ||
        value === "" ||
        value === false
      ) {
        nextParams.delete(key);
        return;
      }

      nextParams.set(key, String(value));
    });

    if (options?.resetPage ?? true) {
      nextParams.delete("page");
    }

    const queryString = nextParams.toString();
    router.push(queryString ? `${pathname}?${queryString}` : pathname);
  }

  function clearAllFilters() {
    const nextParams = new URLSearchParams(searchParams.toString());
    ["category", "minPrice", "maxPrice", "city", "condition", "inStockOnly", "page"].forEach(
      (key) => nextParams.delete(key),
    );
    setMinPrice("");
    setMaxPrice("");
    setCity("");
    const queryString = nextParams.toString();
    router.push(queryString ? `${pathname}?${queryString}` : pathname);
  }

  function renderFiltersContent() {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold">Filters</h3>
            <p className="text-sm text-muted-foreground">
              Narrow listings by type, price, and availability.
            </p>
          </div>
          <Button className="text-brand-sky hover:bg-brand-light hover:text-brand-navy" onClick={clearAllFilters} type="button" variant="ghost">
            Clear All Filters
          </Button>
        </div>

        <div className="space-y-3">
          <Label className="text-sm font-medium">Category</Label>
          <div className="space-y-2">
            {categories.map((category) => {
              const checked = currentFilters.category === category.slug;
              return (
                <label
                  key={category.id}
                  className="flex cursor-pointer items-center gap-3 rounded-lg border border-border/70 px-3 py-2 text-sm"
                >
                  <Checkbox
                    checked={checked}
                    onCheckedChange={() =>
                      updateParams({
                        category: checked ? undefined : category.slug,
                      })
                    }
                  />
                    <span className="flex-1 text-brand-dark">{category.name}</span>
                  {checked ? <Badge variant="secondary">Selected</Badge> : null}
                </label>
              );
            })}
          </div>
        </div>

        <div className="space-y-3">
          <Label className="text-sm font-medium">Price Range</Label>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="min-price" className="text-xs text-muted-foreground">
                Min
              </Label>
              <Input
                id="min-price"
                min="0"
                onChange={(event) => setMinPrice(event.target.value)}
                placeholder="0"
                type="number"
                value={minPrice}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="max-price" className="text-xs text-muted-foreground">
                Max
              </Label>
              <Input
                id="max-price"
                min="0"
                onChange={(event) => setMaxPrice(event.target.value)}
                placeholder="500"
                type="number"
                value={maxPrice}
              />
            </div>
          </div>
            <Button
              className="w-full border-brand-navy text-brand-navy hover:bg-brand-light"
              onClick={() =>
                updateParams({
                minPrice: normalizeValue(minPrice),
                maxPrice: normalizeValue(maxPrice),
              })
            }
            type="button"
            variant="outline"
          >
            Apply
          </Button>
        </div>

        <div className="space-y-3">
          <Label htmlFor="city-filter" className="text-sm font-medium">
            Location
          </Label>
          <div className="space-y-2">
            <Input
              id="city-filter"
              onChange={(event) => setCity(event.target.value)}
              placeholder="Search by city or state"
              value={city}
            />
            <Button
              className="w-full border-brand-navy text-brand-navy hover:bg-brand-light"
              onClick={() => updateParams({ city: normalizeValue(city) })}
              type="button"
              variant="outline"
            >
              Apply Location
            </Button>
          </div>
        </div>

        <div className="space-y-3">
          <Label className="text-sm font-medium">Condition</Label>
          <Select
            onValueChange={(value) =>
              updateParams({ condition: value === "any" ? undefined : value })
            }
            value={currentFilters.condition ?? "any"}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Any condition" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="any">Any</SelectItem>
              {conditionOptions.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center justify-between rounded-xl border border-border/70 bg-white px-4 py-3">
          <div>
            <Label className="text-sm font-medium">In Stock Only</Label>
            <p className="text-xs text-muted-foreground">
              Hide listings that are currently unavailable.
            </p>
          </div>
          <Switch
            checked={currentFilters.inStockOnly ?? false}
            onCheckedChange={(checked) =>
              updateParams({ inStockOnly: checked ? true : undefined })
            }
          />
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="md:hidden">
        <Sheet>
          <SheetTrigger asChild>
            <Button className="w-full border-brand-navy text-brand-navy hover:bg-brand-light" type="button" variant="outline">
              <Filter className="size-4" />
              Filters
            </Button>
          </SheetTrigger>
          <SheetContent className="overflow-y-auto" side="left">
            <SheetHeader>
              <SheetTitle>Filter Listings</SheetTitle>
              <SheetDescription>
                Refine results by category, price, location, and stock.
              </SheetDescription>
            </SheetHeader>
            <div className="p-4 pt-0">{renderFiltersContent()}</div>
          </SheetContent>
        </Sheet>
      </div>

      <aside className="hidden w-64 shrink-0 rounded-2xl border border-border/70 bg-white p-5 md:block">
        {renderFiltersContent()}
      </aside>
    </>
  );
}
