import Link from "next/link";
import { MoreHorizontal, PackagePlus, Plus } from "lucide-react";
import { redirect } from "next/navigation";

import {
  deleteListing,
  getMyListings,
  setListingStatus,
} from "@/actions/listings";
import { StockLevelBadge } from "@/components/inventory/stock-level-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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

  const listings = await getMyListings(user.id);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">My Listings</h1>
          <p className="text-sm text-muted-foreground">
            Manage all your active, paused, and draft listings in one place.
          </p>
        </div>
        <Button asChild>
          <Link href="/listings/new">
            <Plus className="size-4" />
            Create New Listing
          </Link>
        </Button>
      </div>

      {listings.length === 0 ? (
        <EmptyState
          actionHref="/listings/new"
          actionLabel="Create Listing"
          description="Publish your first rentable item to start receiving requests."
          icon={PackagePlus}
          title="You haven't listed anything yet"
        />
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
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="icon" variant="ghost">
                          <MoreHorizontal className="size-4" />
                          <span className="sr-only">Open listing actions</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link href={`/dashboard/my-listings/${listing.id}/edit`}>
                            Edit
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <form
                            action={async () => {
                              "use server";
                              await setListingStatus(
                                listing.id,
                                listing.status === "active" ? "paused" : "active",
                              );
                            }}
                          >
                            <button className="w-full text-left" type="submit">
                              {listing.status === "active" ? "Pause" : "Activate"}
                            </button>
                          </form>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem asChild>
                          <form
                            action={async () => {
                              "use server";
                              await deleteListing(listing.id);
                            }}
                          >
                            <button className="w-full text-left" type="submit">
                              Delete
                            </button>
                          </form>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
