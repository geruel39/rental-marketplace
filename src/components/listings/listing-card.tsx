"use client";

import Link from "next/link";
import { Heart, MapPin, Package, Star } from "lucide-react";

import { StockLevelBadge } from "@/components/inventory/stock-level-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import type { Listing, ListingWithOwner, Profile } from "@/types";

type ListingCardData = Listing & {
  owner?: Pick<Profile, "rating_as_lister" | "total_reviews_as_lister"> | null;
};

interface ListingCardProps {
  listing: ListingCardData | ListingWithOwner;
  showFavorite?: boolean;
}

function getPrimaryPrice(listing: Listing) {
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

export function ListingCard({
  listing,
  showFavorite = true,
}: ListingCardProps) {
  const image = listing.images[0];
  const primaryPrice = getPrimaryPrice(listing);
  const rating = listing.owner?.rating_as_lister ?? 0;
  const reviewCount = listing.owner?.total_reviews_as_lister ?? 0;
  const location = [listing.city, listing.state, listing.location]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="group relative">
      <Link
        aria-label={listing.title}
        className="block rounded-xl"
        href={`/listings/${listing.id}`}
      >
        <Card className="overflow-hidden border-border/70 transition-all duration-200 group-hover:-translate-y-0.5 group-hover:shadow-lg">
          <div className="relative aspect-[4/3] overflow-hidden bg-muted">
            {image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                alt={listing.title}
                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                src={image}
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-muted text-muted-foreground">
                <Package className="size-10" />
              </div>
            )}

            <div className="absolute left-3 top-3 z-10">
              <StockLevelBadge
                lowStockThreshold={listing.low_stock_threshold}
                quantityAvailable={listing.quantity_available}
                trackInventory={listing.track_inventory}
              />
            </div>
          </div>

          <CardContent className="space-y-3 p-4">
            <div className="space-y-1">
              <h3 className="line-clamp-1 font-semibold">{listing.title}</h3>
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <MapPin className="size-3.5 shrink-0" />
                <span className="truncate">{location || "Location not specified"}</span>
              </div>
            </div>

            <div className="flex items-baseline gap-1">
              <span className="text-lg font-semibold">
                {primaryPrice ? formatCurrency(primaryPrice) : "Custom"}
              </span>
              <span className="text-sm text-muted-foreground">
                /{listing.primary_pricing_period}
              </span>
            </div>

            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Star className="size-4 fill-current text-amber-500" />
              <span>{reviewCount > 0 ? rating.toFixed(1) : "New"}</span>
              <span>
                ({reviewCount} review{reviewCount === 1 ? "" : "s"})
              </span>
            </div>
          </CardContent>
        </Card>
      </Link>

      {showFavorite ? (
        <div className="absolute right-3 top-3 z-20">
          <Button
            aria-label="Add to favorites"
            className="rounded-full bg-white/90 shadow-sm hover:bg-white"
            size="icon"
            type="button"
            variant="outline"
          >
            <Heart className="size-4" />
          </Button>
        </div>
      ) : null}
    </div>
  );
}
