"use client";

import Link from "next/link";
import { useState } from "react";
import { MapPin, Package, Star } from "lucide-react";

import { FavoriteButton } from "@/components/listings/favorite-button";
import { StockLevelBadge } from "@/components/inventory/stock-level-badge";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency, formatListingLocation } from "@/lib/utils";
import type { Listing, ListingWithOwner, Profile } from "@/types";

type ListingCardData = Listing & {
  owner?: Pick<Profile, "rating_as_lister" | "total_reviews_as_lister"> | null;
};

interface ListingCardProps {
  listing: ListingCardData | ListingWithOwner;
  showFavorite?: boolean;
  isFavorited?: boolean;
  currentUserId?: string;
  onToggleFavorite?: () => void;
  hideWhenUnfavorited?: boolean;
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
  isFavorited = false,
  currentUserId,
  onToggleFavorite,
  hideWhenUnfavorited = false,
}: ListingCardProps) {
  const [isVisible, setIsVisible] = useState(true);

  const image = listing.images[0];
  const primaryPrice = getPrimaryPrice(listing);
  const rating = listing.owner?.rating_as_lister ?? 0;
  const reviewCount = listing.owner?.total_reviews_as_lister ?? 0;
  const location = formatListingLocation(
    listing.city,
    listing.state,
    listing.location,
  );

  if (!isVisible) {
    return null;
  }

  return (
    <div className="group relative">
      <Link
        aria-label={listing.title}
        className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        href={`/listings/${listing.id}`}
      >
        <Card className="overflow-hidden border-border/70 bg-white transition-all duration-200 group-hover:-translate-y-0.5 group-hover:border-brand-sky/30 group-hover:shadow-md">
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
              <h3 className="line-clamp-1 font-semibold text-brand-dark">{listing.title}</h3>
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <MapPin className="size-3.5 shrink-0" />
                <span className="truncate">{location || "Location not specified"}</span>
              </div>
            </div>

            <div className="flex items-baseline gap-1">
              <span className="text-brand-navy text-lg font-bold">
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
          <FavoriteButton
            className="rounded-full bg-white/90 shadow-sm backdrop-blur hover:bg-white"
            currentUserId={currentUserId}
            isFavorited={isFavorited}
            listingId={listing.id}
            onToggleFavorite={(nextValue) => {
              if (hideWhenUnfavorited && !nextValue) {
                setIsVisible(false);
              }

              onToggleFavorite?.();
            }}
            size="icon"
            variant="outline"
          />
        </div>
      ) : null}
    </div>
  );
}
