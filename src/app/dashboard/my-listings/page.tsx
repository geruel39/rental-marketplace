import Link from "next/link";
import { PackagePlus, Plus } from "lucide-react";
import { redirect } from "next/navigation";

import {
  getMyListings,
} from "@/actions/listings";
import { getPayoutSetupStatus } from "@/actions/payout";
import { StockLevelBadge } from "@/components/inventory/stock-level-badge";
import { MyListingActions } from "@/components/listings/my-listing-actions";
import { EmptyState } from "@/components/shared/empty-state";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency } from "@/lib/utils";

function getListingPrice(
  listing: Awaited<ReturnType<typeof getMyListings>>[number],
) {
  switch (listing.primary_pricing_period) {
    case "hour":
      return listing.price_per_hour;
    case "week":
      return listing.price_per_week;
    case "month":
      return listing.price_per_month;
    case "day":
    default:
      return listing.price_per_day;
  }
}

export default async function MyListingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [listings, payoutStatus] = await Promise.all([
    getMyListings(user.id),
    getPayoutSetupStatus(user.id),
  ]);

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {!payoutStatus.is_complete ? (
          <Alert className="border-amber-200 bg-amber-50 text-amber-900">
            <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <span>Complete payout setup to create listings.</span>
              <Button
                asChild
                className="bg-brand-navy text-white hover:bg-brand-steel"
                size="sm"
              >
                <Link href="/dashboard/settings/payments">Set Up</Link>
              </Button>
            </AlertDescription>
          </Alert>
        ) : null}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">My Listings</h1>
          <p className="text-sm text-muted-foreground">
            Manage all your active, paused, and draft listings in one place.
          </p>
        </div>
        {payoutStatus.is_complete ? (
          <Button asChild>
            <Link href="/listings/new">
              <Plus className="size-4" />
              Create New Listing
            </Link>
          </Button>
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>
              <span>
                <Button disabled type="button">
                  <Plus className="size-4" />
                  Create New Listing
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent side="bottom" sideOffset={8}>
              Complete payout setup first to unlock listing creation.
            </TooltipContent>
          </Tooltip>
        )}
      </div>

      {listings.length === 0 ? (
        payoutStatus.is_complete ? (
          <EmptyState
            actionHref="/listings/new"
            actionLabel="Create Listing"
            description="Publish your first rentable item to start receiving requests."
            icon={PackagePlus}
            title="No listings yet"
          />
        ) : (
          <EmptyState
            actionHref="/dashboard/settings/payments"
            actionLabel="Set Up Payout"
            description="Finish payout setup first, then publish your first rentable item."
            icon={PackagePlus}
            title="No listings yet"
          />
        )
      ) : (
        <div className="rounded-2xl border border-border bg-background">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Listing</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Stock</TableHead>
                <TableHead>Views</TableHead>
                <TableHead className="w-[60px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {listings.map((listing) => (
                <TableRow key={listing.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="size-14 overflow-hidden rounded-lg bg-muted">
                        {listing.images[0] ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            alt={listing.title}
                            className="h-full w-full object-cover"
                            src={listing.images[0]}
                          />
                        ) : null}
                      </div>
                      <div className="space-y-1">
                        <Link
                          className="font-medium hover:underline"
                          href={`/dashboard/my-listings/${listing.id}/edit`}
                        >
                          {listing.title}
                        </Link>
                        <p className="text-sm text-muted-foreground">
                          {listing.city || listing.location}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        listing.status === "active" ? "default" : "secondary"
                      }
                    >
                      {listing.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {formatCurrency(getListingPrice(listing) ?? 0)}
                    <span className="ml-1 text-xs text-muted-foreground">
                      /{listing.primary_pricing_period}
                    </span>
                  </TableCell>
                  <TableCell>
                    <StockLevelBadge
                      lowStockThreshold={listing.low_stock_threshold}
                      quantityAvailable={listing.quantity_available}
                      size="md"
                      trackInventory={listing.track_inventory}
                    />
                  </TableCell>
                  <TableCell>{listing.views_count}</TableCell>
                  <TableCell>
                    <MyListingActions listing={listing} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      </div>
    </TooltipProvider>
  );
}
