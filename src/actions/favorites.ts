"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import type { Favorite, Listing, PaginatedResponse } from "@/types";

const FAVORITES_PER_PAGE = 12;

function getPagination(page?: number, perPage = FAVORITES_PER_PAGE) {
  const currentPage = Math.max(1, page ?? 1);
  const from = (currentPage - 1) * perPage;
  const to = from + perPage - 1;

  return { currentPage, from, to, perPage };
}

function revalidateFavoritePaths(listingId: string) {
  revalidatePath("/");
  revalidatePath("/listings");
  revalidatePath(`/listings/${listingId}`);
  revalidatePath("/dashboard/favorites");
}

export async function toggleFavorite(
  listingId: string,
): Promise<{ isFavorited: boolean } | { error: string }> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { error: "You must be logged in to save listings" };
    }

    const { data: existingFavorite, error: existingError } = await supabase
      .from("favorites")
      .select("id")
      .eq("user_id", user.id)
      .eq("listing_id", listingId)
      .maybeSingle<Pick<Favorite, "id">>();

    if (existingError) {
      console.error("toggleFavorite lookup failed:", existingError);
      return { error: "Could not update your saved listings. Please try again." };
    }

    if (existingFavorite) {
      const { error: deleteError } = await supabase
        .from("favorites")
        .delete()
        .eq("id", existingFavorite.id);

      if (deleteError) {
        console.error("toggleFavorite delete failed:", deleteError);
        return { error: "Could not update your saved listings. Please try again." };
      }

      revalidateFavoritePaths(listingId);
      return { isFavorited: false };
    }

    const { error: insertError } = await supabase.from("favorites").insert({
      user_id: user.id,
      listing_id: listingId,
    });

    if (insertError) {
      console.error("toggleFavorite insert failed:", insertError);
      return { error: "Could not update your saved listings. Please try again." };
    }

    revalidateFavoritePaths(listingId);
    return { isFavorited: true };
  } catch (error) {
    console.error("toggleFavorite failed:", error);
    return { error: "Something went wrong. Please try again." };
  }
}

export async function getFavorites(
  userId: string,
  page?: number,
): Promise<PaginatedResponse<Listing>> {
  const safePage = Math.max(1, page ?? 1);

  try {
    const supabase = await createClient();
    const { currentPage, from, to, perPage } = getPagination(page);

    const { data, error, count } = await supabase
      .from("favorites")
      .select("listing:listings!inner(*)", { count: "exact" })
      .eq("user_id", userId)
      .eq("listing.status", "active")
      .order("created_at", { ascending: false })
      .range(from, to);

    if (error) {
      throw error;
    }

    const listings = (data ?? []).flatMap((row) => {
      if (Array.isArray(row.listing)) {
        return row.listing as Listing[];
      }

      return row.listing ? [row.listing as Listing] : [];
    });

    return {
      data: listings,
      totalCount: count ?? 0,
      totalPages: Math.max(1, Math.ceil((count ?? 0) / perPage)),
      currentPage,
    };
  } catch (error) {
    console.error("getFavorites failed:", error);
    return {
      data: [],
      totalCount: 0,
      totalPages: 0,
      currentPage: safePage,
    };
  }
}

export async function checkFavorites(
  listingIds: string[],
  userId: string,
): Promise<Set<string>> {
  try {
    if (listingIds.length === 0) {
      return new Set<string>();
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("favorites")
      .select("listing_id")
      .eq("user_id", userId)
      .in("listing_id", listingIds);

    if (error) {
      throw error;
    }

    return new Set((data ?? []).map((favorite) => favorite.listing_id));
  } catch (error) {
    console.error("checkFavorites failed:", error);
    return new Set<string>();
  }
}
