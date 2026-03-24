import Link from "next/link";
import { History } from "lucide-react";
import { redirect } from "next/navigation";

import { getInventoryOverview, getStockMovements } from "@/actions/inventory";
import { StockMovementLog } from "@/components/inventory/stock-movement-log";
import { Pagination } from "@/components/shared/pagination";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import type { StockMovementType } from "@/types";

type SearchParams = Record<string, string | string[] | undefined>;

const movementTypeOptions: StockMovementType[] = [
  "initial",
  "adjustment_add",
  "adjustment_remove",
  "adjustment_set",
  "booking_reserved",
  "booking_released",
  "booking_returned",
  "damaged",
  "lost",
];

function getSingleValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function getPage(value: string | undefined) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

export default async function InventoryAdjustmentsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const resolvedSearchParams = await searchParams;
  const listingId = getSingleValue(resolvedSearchParams.listingId);
  const movementType = getSingleValue(resolvedSearchParams.movementType);
  const page = getPage(getSingleValue(resolvedSearchParams.page));

  const [{ listings }, movementPage] = await Promise.all([
    getInventoryOverview(user.id),
    getStockMovements({
      userId: user.id,
      listingId,
      movementType,
      page,
      perPage: 20,
    }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">Stock Adjustment History</h1>
          <p className="text-sm text-muted-foreground">
            Review stock changes across all listings and filter by listing or movement type.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/dashboard/inventory">
            <History className="size-4" />
            Back to Inventory
          </Link>
        </Button>
      </div>

      <form className="grid gap-4 rounded-2xl border border-border bg-background p-4 md:grid-cols-[1fr_1fr_auto]">
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="listingId">
            Listing
          </label>
          <select
            className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
            defaultValue={listingId ?? ""}
            id="listingId"
            name="listingId"
          >
            <option value="">All listings</option>
            {listings.map((listing) => (
              <option key={listing.id} value={listing.id}>
                {listing.title}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="movementType">
            Movement type
          </label>
          <select
            className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
            defaultValue={movementType ?? ""}
            id="movementType"
            name="movementType"
          >
            <option value="">All movement types</option>
            {movementTypeOptions.map((type) => (
              <option key={type} value={type}>
                {type.replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-end">
          <Button type="submit">Apply Filters</Button>
        </div>
      </form>

      <StockMovementLog movements={movementPage.data} showListingName />
      <Pagination
        currentPage={movementPage.currentPage}
        totalPages={movementPage.totalPages}
      />
    </div>
  );
}
