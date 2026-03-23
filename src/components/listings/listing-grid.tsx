import { PackageSearch } from "lucide-react";

import { ListingCard } from "@/components/listings/listing-card";
import { EmptyState } from "@/components/shared/empty-state";
import type { Listing, ListingWithOwner, Profile } from "@/types";

type ListingGridItem = Listing & {
  owner?: Pick<Profile, "rating_as_lister" | "total_reviews_as_lister"> | null;
};

interface ListingGridProps {
  listings: Array<ListingGridItem | ListingWithOwner>;
  emptyMessage?: string;
}

export function ListingGrid({
  listings,
  emptyMessage = "No listings found yet.",
}: ListingGridProps) {
  if (listings.length === 0) {
    return (
      <EmptyState
        actionHref="/listings"
        actionLabel="Browse all listings"
        description={emptyMessage}
        icon={PackageSearch}
        title="Nothing here yet"
      />
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {listings.map((listing) => (
        <ListingCard key={listing.id} listing={listing} />
      ))}
    </div>
  );
}
