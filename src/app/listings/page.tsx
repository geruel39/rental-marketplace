import type { Metadata } from "next";
import { Suspense } from "react";

import { checkFavorites } from "@/actions/favorites";
import { getCategories, searchListings } from "@/actions/listings";
import { ListingFilters } from "@/components/listings/listing-filters";
import { ListingGrid } from "@/components/listings/listing-grid";
import { ListingSort } from "@/components/listings/listing-sort";
import { ListingGridSkeleton } from "@/components/shared/loading-skeleton";
import { Pagination } from "@/components/shared/pagination";
import { createClient } from "@/lib/supabase/server";

type SearchParams = Record<string, string | string[] | undefined>;

interface ListingsPageProps {
  searchParams: Promise<SearchParams>;
}

export const metadata: Metadata = {
  title: "Browse Listings — RentHub",
  description:
    "Search rental listings by category, price, stock availability, and location on RentHub.",
  openGraph: {
    title: "Browse Listings — RentHub",
    description:
      "Search rental listings by category, price, stock availability, and location on RentHub.",
  },
};

function getSingleValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function parseNumber(value: string | undefined) {
  if (!value) {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parsePage(value: string | undefined) {
  const parsed = parseNumber(value);
  return parsed && parsed > 0 ? Math.floor(parsed) : 1;
}

function parseBoolean(value: string | undefined) {
  return value === "true" || value === "1";
}

async function ListingsContent({
  searchParams,
}: ListingsPageProps) {
  const supabase = await createClient();
  const resolvedParams = await searchParams;
  const query = getSingleValue(resolvedParams.q);
  const category = getSingleValue(resolvedParams.category);
  const minPrice = parseNumber(getSingleValue(resolvedParams.minPrice));
  const maxPrice = parseNumber(getSingleValue(resolvedParams.maxPrice));
  const city = getSingleValue(resolvedParams.city);
  const condition = getSingleValue(resolvedParams.condition);
  const inStockOnly = parseBoolean(getSingleValue(resolvedParams.inStockOnly));
  const sort = getSingleValue(resolvedParams.sort) ?? "newest";
  const page = parsePage(getSingleValue(resolvedParams.page));

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [categories, results] = await Promise.all([
    getCategories(),
    searchListings({
      query,
      category,
      minPrice,
      maxPrice,
      city,
      condition,
      inStockOnly,
      sortBy: sort,
      page,
      perPage: 12,
    }),
  ]);
  const favoriteIds = user
    ? await checkFavorites(
        results.data.map((listing) => listing.id),
        user.id,
      )
    : new Set<string>();

  return (
    <main className="bg-brand-light mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 space-y-2">
        <h1 className="text-brand-dark text-3xl font-semibold tracking-tight">Browse Listings</h1>
        <p className="text-muted-foreground">
          Find tools, gear, and everyday items available to rent near you.
        </p>
      </div>

      <div className="flex flex-col gap-6 md:flex-row md:items-start">
        <ListingFilters
          categories={categories}
          currentFilters={{
            category,
            minPrice: minPrice?.toString(),
            maxPrice: maxPrice?.toString(),
            city,
            condition,
            inStockOnly,
          }}
        />

        <div className="min-w-0 flex-1 space-y-6">
          <div className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold">
                {results.totalCount} listing{results.totalCount === 1 ? "" : "s"} found
              </h2>
              <p className="text-sm text-muted-foreground">
                Page {results.currentPage}
                {results.totalPages > 0 ? ` of ${results.totalPages}` : ""}
              </p>
            </div>
            <ListingSort currentSort={sort} />
          </div>

          <ListingGrid
            currentUserId={user?.id}
            emptyMessage="Try adjusting your filters or search terms to find more listings."
            favoritedIds={Array.from(favoriteIds)}
            listings={results.data}
          />

          <Pagination
            currentPage={results.currentPage}
            totalPages={results.totalPages}
          />
        </div>
      </div>
    </main>
  );
}

export default function ListingsPage({ searchParams }: ListingsPageProps) {
  return (
    <Suspense
      fallback={
        <main className="bg-brand-light mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="mb-6 space-y-2">
            <div className="h-9 w-52 rounded-md bg-accent" />
            <div className="h-5 w-80 rounded-md bg-accent" />
          </div>
          <div className="flex flex-col gap-6 md:flex-row md:items-start">
            <div className="hidden w-64 shrink-0 rounded-2xl border border-border/70 bg-white p-5 md:block">
              <div className="space-y-3">
                <div className="h-5 w-20 rounded-md bg-accent" />
                <div className="h-10 w-full rounded-md bg-accent" />
                <div className="h-10 w-full rounded-md bg-accent" />
                <div className="h-10 w-full rounded-md bg-accent" />
              </div>
            </div>
            <div className="min-w-0 flex-1 space-y-6">
              <div className="rounded-2xl border border-border/70 bg-white p-4">
                <div className="h-10 w-full rounded-md bg-accent sm:w-56" />
              </div>
              <ListingGridSkeleton />
            </div>
          </div>
        </main>
      }
    >
      <ListingsContent searchParams={searchParams} />
    </Suspense>
  );
}
