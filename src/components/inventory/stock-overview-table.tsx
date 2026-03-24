"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowDownAZ,
  ArrowUpDown,
  Boxes,
  MoreHorizontal,
  Pencil,
  SlidersHorizontal,
} from "lucide-react";

import { StockAdjustmentForm } from "@/components/inventory/stock-adjustment-form";
import { StockLevelBadge } from "@/components/inventory/stock-level-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Listing, StockStatus } from "@/types";

interface StockOverviewTableProps {
  listings: (Listing & { stockStatus: StockStatus })[];
}

type FilterValue = "all" | "in_stock" | "low_stock" | "out_of_stock";
type SortValue = "title" | "stock" | "updated";

const filterTabs: { value: FilterValue; label: string }[] = [
  { value: "all", label: "All" },
  { value: "in_stock", label: "In Stock" },
  { value: "low_stock", label: "Low Stock" },
  { value: "out_of_stock", label: "Out of Stock" },
];

export function StockOverviewTable({ listings }: StockOverviewTableProps) {
  const [filter, setFilter] = useState<FilterValue>("all");
  const [sortBy, setSortBy] = useState<SortValue>("updated");
  const [adjustingListing, setAdjustingListing] = useState<Listing | null>(null);

  const filteredListings = useMemo(() => {
    const nextListings =
      filter === "all"
        ? listings
        : listings.filter((listing) => listing.stockStatus === filter);

    return [...nextListings].sort((a, b) => {
      switch (sortBy) {
        case "title":
          return a.title.localeCompare(b.title);
        case "stock":
          return a.quantity_available - b.quantity_available;
        case "updated":
        default:
          return (
            new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
          );
      }
    });
  }, [filter, listings, sortBy]);

  if (listings.length === 0) {
    return (
      <EmptyState
        actionHref="/listings/new"
        actionLabel="Create Listing"
        description="Add your first rentable item to start managing stock levels here."
        icon={Boxes}
        title="No inventory yet"
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <Tabs onValueChange={(value) => setFilter(value as FilterValue)} value={filter}>
          <TabsList variant="line">
            {filterTabs.map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value}>
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <div className="flex items-center gap-2">
          <div className="hidden items-center gap-2 text-sm text-muted-foreground sm:flex">
            <SlidersHorizontal className="size-4" />
            Sort by
          </div>
          <Select onValueChange={(value) => setSortBy(value as SortValue)} value={sortBy}>
            <SelectTrigger className="w-full sm:w-56">
              <SelectValue placeholder="Sort listings" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="title">
                <span className="flex items-center gap-2">
                  <ArrowDownAZ className="size-4" />
                  Title
                </span>
              </SelectItem>
              <SelectItem value="stock">
                <span className="flex items-center gap-2">
                  <ArrowUpDown className="size-4" />
                  Stock Level
                </span>
              </SelectItem>
              <SelectItem value="updated">
                <span className="flex items-center gap-2">
                  <ArrowUpDown className="size-4" />
                  Last Updated
                </span>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {filteredListings.length === 0 ? (
        <EmptyState
          description="Try a different stock filter or sort option."
          icon={Boxes}
          title="No listings match this view"
        />
      ) : (
        <div className="rounded-2xl border border-border bg-background">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Image</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Available</TableHead>
                <TableHead>Reserved</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[60px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredListings.map((listing) => (
                <TableRow key={listing.id}>
                  <TableCell>
                    <div className="size-10 overflow-hidden rounded-lg bg-muted">
                      {listing.images[0] ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          alt={listing.title}
                          className="h-full w-full object-cover"
                          src={listing.images[0]}
                        />
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell className="max-w-[260px] whitespace-normal">
                    <Link
                      className="font-medium transition-colors hover:text-primary hover:underline"
                      href={`/listings/${listing.id}`}
                    >
                      {listing.title}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {listing.sku || "No SKU"}
                  </TableCell>
                  <TableCell>{listing.quantity_total}</TableCell>
                  <TableCell>{listing.quantity_available}</TableCell>
                  <TableCell>{listing.quantity_reserved}</TableCell>
                  <TableCell>
                    {listing.track_inventory ? (
                      <StockLevelBadge
                        lowStockThreshold={listing.low_stock_threshold}
                        quantityAvailable={listing.quantity_available}
                        size="md"
                        trackInventory={listing.track_inventory}
                      />
                    ) : (
                      <span className="text-sm text-muted-foreground">Not tracked</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="icon-sm" variant="ghost">
                          <MoreHorizontal className="size-4" />
                          <span className="sr-only">Open inventory actions</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onSelect={() => {
                            setAdjustingListing(listing);
                          }}
                        >
                          Adjust Stock
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link href={`/dashboard/inventory/${listing.id}`}>
                            View Details
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link href={`/dashboard/my-listings/${listing.id}/edit`}>
                            <Pencil className="size-4" />
                            Edit Listing
                          </Link>
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

      {adjustingListing ? (
        <StockAdjustmentForm
          listing={adjustingListing}
          onOpenChange={(open) => {
            if (!open) {
              setAdjustingListing(null);
            }
          }}
          open
          trigger={null}
        />
      ) : null}
    </div>
  );
}
