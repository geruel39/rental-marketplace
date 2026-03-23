"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Category } from "@/types";

interface SearchBarProps {
  categories?: Category[];
}

export function SearchBar({ categories = [] }: SearchBarProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("all");

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const searchParams = new URLSearchParams();

    if (query.trim()) {
      searchParams.set("q", query.trim());
    }

    if (category !== "all") {
      searchParams.set("category", category);
    }

    const nextUrl = searchParams.toString()
      ? `/listings?${searchParams.toString()}`
      : "/listings";

    router.push(nextUrl);
  }

  return (
    <form
      className="flex w-full flex-col gap-3 rounded-2xl bg-background/95 p-3 shadow-lg sm:flex-row sm:items-center"
      onSubmit={onSubmit}
    >
      <div className="relative flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          aria-label="Search listings"
          className="border-border/70 bg-background pl-10"
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search for anything..."
          value={query}
        />
      </div>

      {categories.length > 0 ? (
        <Select onValueChange={setCategory} value={category}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {categories.map((item) => (
              <SelectItem key={item.id} value={item.slug}>
                {item.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : null}

      <Button className="w-full sm:w-auto" type="submit">
        <Search className="size-4" />
        Search
      </Button>
    </form>
  );
}
