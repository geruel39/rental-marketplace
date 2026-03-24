"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { stockAdjustmentSchema } from "@/lib/validations";
import type {
  ActionResponse,
  Booking,
  InventoryMovement,
  InventorySummary,
  Listing,
  PaginatedResponse,
  StockMovementType,
  StockStatus,
} from "@/types";

type ListingWithStockStatus = Listing & {
  stockStatus: StockStatus;
};

type InventoryMovementRow = InventoryMovement & {
  booking?: Pick<Booking, "id"> | null;
  listings?: {
    title: string;
  } | null;
};

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function getStockStatus(listing: Listing): StockStatus {
  if (!listing.track_inventory) {
    return "not_tracked";
  }

  if (listing.quantity_available === 0) {
    return "out_of_stock";
  }

  if (listing.quantity_available <= (listing.low_stock_threshold ?? 1)) {
    return "low_stock";
  }

  return "in_stock";
}

function getPagination(page?: number, perPage?: number) {
  const currentPage = Math.max(1, page ?? 1);
  const pageSize = Math.max(1, Math.min(perPage ?? 20, 100));
  const from = (currentPage - 1) * pageSize;
  const to = from + pageSize - 1;

  return { currentPage, pageSize, from, to };
}

function revalidateInventoryViews() {
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/inventory");
  revalidatePath("/dashboard/my-listings");
}

export async function getInventoryOverview(userId: string): Promise<{
  listings: ListingWithStockStatus[];
  summary: InventorySummary;
}> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("listings")
    .select("*")
    .eq("owner_id", userId)
    .neq("status", "archived")
    .order("updated_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  const listings = ((data ?? []) as Listing[]).map((listing) => ({
    ...listing,
    stockStatus: getStockStatus(listing),
  }));

  const summary = listings.reduce<InventorySummary>(
    (acc, listing) => {
      acc.totalListings += 1;
      acc.totalItemsAvailable += listing.quantity_available;
      acc.totalItemsReserved += listing.quantity_reserved;

      switch (listing.stockStatus) {
        case "in_stock":
          acc.inStockCount += 1;
          break;
        case "low_stock":
          acc.lowStockCount += 1;
          break;
        case "out_of_stock":
          acc.outOfStockCount += 1;
          break;
        default:
          break;
      }

      return acc;
    },
    {
      totalListings: 0,
      inStockCount: 0,
      lowStockCount: 0,
      outOfStockCount: 0,
      totalItemsAvailable: 0,
      totalItemsReserved: 0,
    },
  );

  return { listings, summary };
}

export async function getListingStock(
  listingId: string,
  userId: string,
): Promise<{
  listing: Listing;
  movements: InventoryMovement[];
  totalMovements: number;
} | null> {
  const supabase = await createClient();
  const { data: listing, error: listingError } = await supabase
    .from("listings")
    .select("*")
    .eq("id", listingId)
    .eq("owner_id", userId)
    .neq("status", "archived")
    .maybeSingle<Listing>();

  if (listingError) {
    throw new Error(listingError.message);
  }

  if (!listing) {
    return null;
  }

  const { data: movements, error: movementError, count } = await supabase
    .from("inventory_movements")
    .select(
      `
        *,
        booking:bookings (
          id
        )
      `,
      { count: "exact" },
    )
    .eq("listing_id", listingId)
    .order("created_at", { ascending: false })
    .range(0, 19);

  if (movementError) {
    throw new Error(movementError.message);
  }

  return {
    listing,
    movements: (movements ?? []) as InventoryMovement[],
    totalMovements: count ?? 0,
  };
}

export async function adjustStock(
  prevState: ActionResponse | null,
  formData: FormData,
): Promise<ActionResponse> {
  void prevState;

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { error: "You must be signed in to adjust stock" };
    }

    const parsed = stockAdjustmentSchema.safeParse({
      listing_id: formData.get("listing_id"),
      adjustment_type: formData.get("adjustment_type"),
      quantity: formData.get("quantity"),
      reason: formData.get("reason"),
    });

    if (!parsed.success) {
      return {
        error: parsed.error.issues[0]?.message ?? "Invalid stock adjustment",
      };
    }

    const { data: listing, error: listingError } = await supabase
      .from("listings")
      .select("id")
      .eq("id", parsed.data.listing_id)
      .eq("owner_id", user.id)
      .maybeSingle<{ id: string }>();

    if (listingError) {
      return { error: listingError.message };
    }

    if (!listing) {
      return { error: "Listing not found" };
    }

    const { error: rpcError } = await supabase.rpc("adjust_stock", {
      p_listing_id: parsed.data.listing_id,
      p_user_id: user.id,
      p_adjustment_type: parsed.data.adjustment_type,
      p_quantity: parsed.data.quantity,
      p_reason: parsed.data.reason.trim(),
    });

    if (rpcError) {
      return { error: rpcError.message };
    }

    revalidateInventoryViews();
    revalidatePath(`/dashboard/my-listings/${parsed.data.listing_id}/edit`);

    return { success: "Stock adjusted successfully" };
  } catch (error) {
    return { error: getErrorMessage(error, "Failed to adjust stock") };
  }
}

export async function getStockMovements({
  userId,
  listingId,
  movementType,
  page,
  perPage,
}: {
  userId: string;
  listingId?: string;
  movementType?: string;
  page?: number;
  perPage?: number;
}): Promise<PaginatedResponse<InventoryMovement & { listing_title: string }>> {
  const supabase = await createClient();
  const { currentPage, pageSize, from, to } = getPagination(page, perPage);

  let query = supabase
    .from("inventory_movements")
    .select(
      `
        *,
        listings!inner (
          title,
          owner_id
        )
      `,
      { count: "exact" },
    )
    .eq("listings.owner_id", userId)
    .order("created_at", { ascending: false });

  if (listingId) {
    query = query.eq("listing_id", listingId);
  }

  if (movementType) {
    query = query.eq("movement_type", movementType as StockMovementType);
  }

  const { data, error, count } = await query.range(from, to);

  if (error) {
    throw new Error(error.message);
  }

  const totalCount = count ?? 0;
  const totalPages = totalCount === 0 ? 0 : Math.ceil(totalCount / pageSize);
  const rows = (data ?? []) as InventoryMovementRow[];

  return {
    data: rows.map((row) => ({
      ...row,
      listing_title: row.listings?.title ?? "Untitled listing",
    })),
    totalCount,
    totalPages,
    currentPage,
  };
}

export async function getLowStockListings(userId: string): Promise<Listing[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("listings")
    .select("*")
    .eq("owner_id", userId)
    .eq("track_inventory", true)
    .neq("status", "archived")
    .order("quantity_available", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as Listing[]).filter(
    (listing) => listing.quantity_available <= (listing.low_stock_threshold ?? 1),
  );
}
