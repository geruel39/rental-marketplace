import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound, redirect } from "next/navigation";

import { getListingStock, getStockMovements } from "@/actions/inventory";
import { StockAdjustmentForm } from "@/components/inventory/stock-adjustment-form";
import { StockMovementLog } from "@/components/inventory/stock-movement-log";
import { Pagination } from "@/components/shared/pagination";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { createClient } from "@/lib/supabase/server";

type SearchParams = Record<string, string | string[] | undefined>;

function getSingleValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function getPage(value: string | undefined) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

export default async function InventoryListingDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ listingId: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { listingId } = await params;
  const resolvedSearchParams = await searchParams;
  const page = getPage(getSingleValue(resolvedSearchParams.page));
  const stockData = await getListingStock(listingId, user.id);

  if (!stockData) {
    notFound();
  }

  const movementPage = await getStockMovements({
    userId: user.id,
    listingId,
    page,
    perPage: 20,
  });

  const thresholdLabel = stockData.listing.track_inventory
    ? String(stockData.listing.low_stock_threshold ?? 1)
    : "Not tracked";

  return (
    <div className="space-y-6">
      <Button asChild size="sm" variant="ghost">
        <Link href="/dashboard/inventory">
          <ArrowLeft className="size-4" />
          Back to Inventory
        </Link>
      </Button>

      <div className="flex flex-col gap-6 rounded-3xl border border-border bg-background p-6 shadow-sm lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 gap-4">
          <div className="size-20 overflow-hidden rounded-2xl bg-muted">
            {stockData.listing.images[0] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                alt={stockData.listing.title}
                className="h-full w-full object-cover"
                src={stockData.listing.images[0]}
              />
            ) : null}
          </div>
          <div className="min-w-0 space-y-2">
            <h1 className="text-2xl font-semibold tracking-tight">
              {stockData.listing.title}
            </h1>
            <p className="text-sm text-muted-foreground">
              SKU: {stockData.listing.sku || "No SKU"}
            </p>
          </div>
        </div>

        <StockAdjustmentForm listing={stockData.listing} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Total", value: stockData.listing.quantity_total },
          { label: "Available", value: stockData.listing.quantity_available },
          { label: "Reserved", value: stockData.listing.quantity_reserved },
          { label: "Threshold", value: thresholdLabel },
        ].map((item) => (
          <div
            key={item.label}
            className="rounded-2xl border border-border bg-background p-5 shadow-sm"
          >
            <p className="text-sm text-muted-foreground">{item.label}</p>
            <p className="mt-2 text-2xl font-semibold">{item.value}</p>
          </div>
        ))}
      </div>

      <Separator />

      <div className="space-y-4">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold">Stock Movement History</h2>
          <p className="text-sm text-muted-foreground">
            Audit every reservation, return, and manual adjustment for this listing.
          </p>
        </div>
        <StockMovementLog movements={movementPage.data} />
        <Pagination
          currentPage={movementPage.currentPage}
          totalPages={movementPage.totalPages}
        />
      </div>
    </div>
  );
}
