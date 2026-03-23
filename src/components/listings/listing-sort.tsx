"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ListingSortProps {
  currentSort?: string;
}

export function ListingSort({ currentSort = "newest" }: ListingSortProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function onValueChange(value: string) {
    const nextParams = new URLSearchParams(searchParams.toString());

    if (value === "newest") {
      nextParams.delete("sort");
    } else {
      nextParams.set("sort", value);
    }

    nextParams.delete("page");

    const queryString = nextParams.toString();
    router.push(queryString ? `${pathname}?${queryString}` : pathname);
  }

  return (
    <Select onValueChange={onValueChange} value={currentSort}>
      <SelectTrigger className="w-full sm:w-56">
        <SelectValue placeholder="Sort by" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="newest">Newest</SelectItem>
        <SelectItem value="price_asc">Price Low to High</SelectItem>
        <SelectItem value="price_desc">Price High to Low</SelectItem>
        <SelectItem value="rating">Most Popular</SelectItem>
      </SelectContent>
    </Select>
  );
}
