import { Heart } from "lucide-react";
import { redirect } from "next/navigation";

import { getFavorites } from "@/actions/favorites";
import { ListingGrid } from "@/components/listings/listing-grid";
import { EmptyState } from "@/components/shared/empty-state";
import { Pagination } from "@/components/shared/pagination";
import { createClient } from "@/lib/supabase/server";

interface FavoritesPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function getPage(value: string | string[] | undefined) {
  const rawValue = Array.isArray(value) ? value[0] : value;
  const page = Number(rawValue ?? "1");

  return Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
}

export default async function FavoritesPage({
  searchParams,
}: FavoritesPageProps) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const resolvedSearchParams = await searchParams;
  const page = getPage(resolvedSearchParams.page);
  const favorites = await getFavorites(user.id, page);

  if (favorites.data.length === 0) {
    return (
      <EmptyState
        actionHref="/listings"
        actionLabel="Browse Listings"
        description="Browse listings to find items you love!"
        icon={Heart}
        title="No saved listings yet"
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Saved Listings</h1>
        <p className="text-sm text-muted-foreground">
          Keep track of items you want to rent later.
        </p>
      </div>

      <ListingGrid
        currentUserId={user.id}
        favoritedIds={favorites.data.map((listing) => listing.id)}
        hideUnfavoritedCards
        listings={favorites.data}
      />

      <Pagination currentPage={favorites.currentPage} totalPages={favorites.totalPages} />
    </div>
  );
}
