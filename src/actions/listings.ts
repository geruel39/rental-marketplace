"use server";

import { redirect } from "next/navigation";

import { canCreateListing } from "@/actions/payout";
import { hasSupabaseEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { listingSchema } from "@/lib/validations";
import type {
  ActionResponse,
  Category,
  Listing,
  PaginatedResponse,
  ListingStatus,
  ListingWithOwner,
  Profile,
  ReviewWithUsers,
} from "@/types";

const LISTING_IMAGES_BUCKET = "listing-images";

function toOptionalString(value: FormDataEntryValue | null) {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function toBoolean(value: FormDataEntryValue | null) {
  return value === "true" || value === "on" || value === "1";
}

function sanitizeFilename(filename: string) {
  return filename.replace(/[^a-zA-Z0-9._-]/g, "-");
}

async function uploadListingImages(userId: string, files: File[]) {
  const supabase = await createClient();
  const uploadedUrls: string[] = [];

  for (const file of files) {
    const filePath = `${userId}/${crypto.randomUUID()}-${sanitizeFilename(file.name)}`;
    const fileBuffer = await file.arrayBuffer();

    const { error: uploadError } = await supabase.storage
      .from(LISTING_IMAGES_BUCKET)
      .upload(filePath, fileBuffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      throw new Error(uploadError.message);
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from(LISTING_IMAGES_BUCKET).getPublicUrl(filePath);

    uploadedUrls.push(publicUrl);
  }

  return uploadedUrls;
}

async function getAuthenticatedUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return { supabase, user };
}

function buildListingInput(formData: FormData, images: string[]) {
  return {
    title: formData.get("title"),
    description: formData.get("description"),
    category_id: toOptionalString(formData.get("category_id")),
    price_per_hour: toOptionalString(formData.get("price_per_hour")),
    price_per_day: toOptionalString(formData.get("price_per_day")),
    price_per_week: toOptionalString(formData.get("price_per_week")),
    price_per_month: toOptionalString(formData.get("price_per_month")),
    primary_pricing_period: formData.get("primary_pricing_period") ?? "day",
    deposit_amount: toOptionalString(formData.get("deposit_amount")) ?? 0,
    minimum_rental_period:
      toOptionalString(formData.get("minimum_rental_period")) ?? 1,
    location: formData.get("location"),
    latitude: toOptionalString(formData.get("latitude")),
    longitude: toOptionalString(formData.get("longitude")),
    city: toOptionalString(formData.get("city")),
    state: toOptionalString(formData.get("state")),
    delivery_available: toBoolean(formData.get("delivery_available")),
    delivery_fee: toOptionalString(formData.get("delivery_fee")) ?? 0,
    delivery_radius_km: toOptionalString(formData.get("delivery_radius_km")),
    pickup_instructions: toOptionalString(formData.get("pickup_instructions")),
    images,
    brand: toOptionalString(formData.get("brand")),
    model: toOptionalString(formData.get("model")),
    condition: toOptionalString(formData.get("condition")),
    quantity_total: toOptionalString(formData.get("quantity_total")) ?? 1,
    track_inventory: true,
    low_stock_threshold:
      toOptionalString(formData.get("low_stock_threshold")) ?? 1,
    sku: toOptionalString(formData.get("sku")),
    rules: toOptionalString(formData.get("rules")),
    cancellation_policy:
      formData.get("cancellation_policy") ?? "flexible",
    instant_book: toBoolean(formData.get("instant_book")),
    min_renter_rating: toOptionalString(formData.get("min_renter_rating")),
  };
}

function getListingStatus(formData: FormData): ListingStatus {
  const rawStatus = formData.get("status");
  return rawStatus === "draft" ? "draft" : "active";
}

function getUploadedFiles(formData: FormData) {
  return formData
    .getAll("images")
    .filter((entry): entry is File => entry instanceof File && entry.size > 0);
}

function getExistingImages(formData: FormData) {
  return formData
    .getAll("existing_images")
    .filter((entry): entry is string => typeof entry === "string" && entry.length > 0);
}

export async function createListing(formData: FormData): Promise<ActionResponse> {
  try {
    const { supabase, user } = await getAuthenticatedUser();
    const listingAccess = await canCreateListing(user.id);

    if (!listingAccess.allowed) {
      return {
        error:
          listingAccess.reason ??
          "Please set up your payout method in Settings before creating a listing.",
      };
    }

    const uploadedFiles = getUploadedFiles(formData);
    const imageUrls = await uploadListingImages(user.id, uploadedFiles);
    const input = buildListingInput(formData, imageUrls);
    const status = getListingStatus(formData);
    const validated = listingSchema.safeParse(input);

    if (!validated.success) {
      return {
        error: validated.error.issues[0]?.message ?? "Invalid listing data",
      };
    }

    const quantityTotal = validated.data.quantity_total;
    const pickupInstructions = toOptionalString(formData.get("pickup_instructions"));

    const { data: listing, error: insertError } = await supabase
      .from("listings")
      .insert({
        owner_id: user.id,
        ...validated.data,
        pickup_instructions: pickupInstructions,
        status,
        quantity_available: quantityTotal,
        quantity_reserved: 0,
      })
      .select()
      .single<Listing>();

    if (insertError) {
      return { error: insertError.message };
    }

    const { error: movementError } = await supabase
      .from("inventory_movements")
      .insert({
        listing_id: listing.id,
        user_id: user.id,
        movement_type: "initial",
        quantity_change: quantityTotal,
        quantity_before: 0,
        quantity_after: quantityTotal,
        reason: "Initial stock",
      });

    if (movementError) {
      return { error: movementError.message };
    }
  } catch (error) {
    console.error("createListing failed:", error);
    return { error: "Something went wrong. Please try again." };
  }

  redirect("/dashboard/my-listings");
}

export async function updateListing(
  listingId: string,
  formData: FormData,
): Promise<ActionResponse> {
  try {
    const { supabase, user } = await getAuthenticatedUser();

    const { data: existingListing, error: listingError } = await supabase
      .from("listings")
      .select("*")
      .eq("id", listingId)
      .eq("owner_id", user.id)
      .single<Listing>();

    if (listingError || !existingListing) {
      return { error: "Listing not found" };
    }

    const existingImages = getExistingImages(formData);
    const uploadedFiles = getUploadedFiles(formData);
    const uploadedUrls = await uploadListingImages(user.id, uploadedFiles);
    const imageUrls = [...existingImages, ...uploadedUrls];
    const input = buildListingInput(formData, imageUrls);
    const status = getListingStatus(formData);
    const validated = listingSchema.safeParse(input);

    if (!validated.success) {
      return {
        error: validated.error.issues[0]?.message ?? "Invalid listing data",
      };
    }

    if (validated.data.quantity_total !== existingListing.quantity_total) {
      const { error: rpcError } = await supabase.rpc("adjust_stock", {
        p_listing_id: listingId,
        p_user_id: user.id,
        p_adjustment_type: "adjustment_set",
        p_quantity: validated.data.quantity_total,
        p_reason: "Updated listing quantity",
      });

      if (rpcError) {
        return { error: rpcError.message };
      }
    }

    const { error: updateError } = await supabase
      .from("listings")
      .update({
        ...validated.data,
        pickup_instructions: toOptionalString(formData.get("pickup_instructions")),
        status,
      })
      .eq("id", listingId)
      .eq("owner_id", user.id);

    if (updateError) {
      return { error: updateError.message };
    }
  } catch (error) {
    console.error("updateListing failed:", error);
    return { error: "Something went wrong. Please try again." };
  }

  redirect("/dashboard/my-listings");
}

export async function deleteListing(listingId: string): Promise<ActionResponse> {
  try {
    const { supabase, user } = await getAuthenticatedUser();

    const { data: listing, error: listingError } = await supabase
      .from("listings")
      .select("id")
      .eq("id", listingId)
      .eq("owner_id", user.id)
      .maybeSingle<{ id: string }>();

    if (listingError || !listing) {
      return { error: "Listing not found" };
    }

    const { error: updateError } = await supabase
      .from("listings")
      .update({ status: "archived" })
      .eq("id", listingId)
      .eq("owner_id", user.id);

    if (updateError) {
      return { error: updateError.message };
    }
  } catch (error) {
    console.error("deleteListing failed:", error);
    return { error: "Something went wrong. Please try again." };
  }

  redirect("/dashboard/my-listings");
}

export async function setListingStatus(
  listingId: string,
  status: "active" | "paused",
): Promise<ActionResponse> {
  try {
    const { supabase, user } = await getAuthenticatedUser();

    const { data: listing, error: listingError } = await supabase
      .from("listings")
      .select("id")
      .eq("id", listingId)
      .eq("owner_id", user.id)
      .maybeSingle<{ id: string }>();

    if (listingError || !listing) {
      return { error: "Listing not found" };
    }

    const { error: updateError } = await supabase
      .from("listings")
      .update({ status })
      .eq("id", listingId)
      .eq("owner_id", user.id);

    if (updateError) {
      return { error: updateError.message };
    }
  } catch (error) {
    console.error("setListingStatus failed:", error);
    return { error: "Something went wrong. Please try again." };
  }

  return { success: "Listing updated" };
}

export async function getMyListings(userId: string): Promise<Listing[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("listings")
      .select("*")
      .eq("owner_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      throw error;
    }

    return (data ?? []) as Listing[];
  } catch (error) {
    console.error("getMyListings failed:", error);
    return [];
  }
}

export async function getListing(
  listingId: string,
): Promise<ListingWithOwner | null> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("listings")
      .select("*, owner:profiles!listings_owner_id_fkey(*)")
      .eq("id", listingId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return (data as ListingWithOwner | null) ?? null;
  } catch (error) {
    console.error("getListing failed:", error);
    return null;
  }
}

export async function getListingWithDetails(listingId: string): Promise<{
  listing: Listing;
  owner: Profile;
  reviews: ReviewWithUsers[];
  similarListings: Listing[];
} | null> {
  try {
    const supabase = await createClient();

    const { data: listingRow, error: listingError } = await supabase
      .from("listings")
      .select("*, owner:profiles!listings_owner_id_fkey(*)")
      .eq("id", listingId)
      .maybeSingle();

    if (listingError || !listingRow) {
      return null;
    }

    const listingWithOwner = listingRow as ListingWithOwner;

    const [{ data: reviewsData }, { data: similarListingsData }] = await Promise.all([
      supabase
        .from("reviews")
        .select(
          `
            *,
            reviewer:profiles!reviews_reviewer_id_fkey(*),
            reviewee:profiles!reviews_reviewee_id_fkey(*)
          `,
        )
        .eq("listing_id", listingId)
        .order("created_at", { ascending: false })
        .limit(5),
      supabase
        .from("listings")
        .select("*")
        .eq("status", "active")
        .eq("category_id", listingWithOwner.category_id)
        .neq("id", listingId)
        .limit(4),
    ]);

    const { error: incrementViewsError } = await supabase.rpc("increment_views", {
      p_listing_id: listingId,
    });

    if (incrementViewsError) {
      console.error("Failed to increment listing views:", incrementViewsError.message);
    }

    return {
      listing: listingWithOwner,
      owner: listingWithOwner.owner,
      reviews: (reviewsData ?? []) as ReviewWithUsers[],
      similarListings: (similarListingsData ?? []) as Listing[],
    };
  } catch (error) {
    console.error("getListingWithDetails failed:", error);
    return null;
  }
}

export async function getCategories(): Promise<Category[]> {
  if (!hasSupabaseEnv()) {
    return [];
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("categories")
      .select("*")
      .eq("is_active", true)
      .order("sort_order", { ascending: true });

    if (error) {
      throw error;
    }

    return (data ?? []) as Category[];
  } catch (error) {
    console.error("getCategories failed:", error);
    return [];
  }
}

interface SearchListingsParams {
  query?: string;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  city?: string;
  condition?: string;
  inStockOnly?: boolean;
  sortBy?: string;
  page?: number;
  perPage?: number;
}

export async function searchListings({
  query,
  category,
  minPrice,
  maxPrice,
  city,
  condition,
  inStockOnly,
  sortBy,
  page = 1,
  perPage = 12,
}: SearchListingsParams): Promise<PaginatedResponse<Listing>> {
  if (!hasSupabaseEnv()) {
    return {
      data: [],
      totalCount: 0,
      totalPages: 0,
      currentPage: page,
    };
  }

  const currentPage = Math.max(1, page);
  const pageSize = Math.max(1, perPage);
  const from = (currentPage - 1) * pageSize;
  const to = currentPage * pageSize - 1;

  try {
    const supabase = await createClient();
    let categoryId: string | undefined;
    if (category) {
      const { data: categoryRow, error: categoryError } = await supabase
        .from("categories")
        .select("id")
        .eq("slug", category)
        .eq("is_active", true)
        .maybeSingle<{ id: string }>();

      if (categoryError) {
        throw categoryError;
      }

      categoryId = categoryRow?.id;

      if (!categoryId) {
        return {
          data: [],
          totalCount: 0,
          totalPages: 0,
          currentPage,
        };
      }
    }

    let listingsQuery = supabase
      .from("listings")
      .select(
        "*, owner:profiles!listings_owner_id_fkey(id, display_name, avatar_url, rating_as_lister, total_reviews_as_lister)",
        { count: "exact" },
      )
      .eq("status", "active");

    if (query) {
      listingsQuery = listingsQuery.textSearch("search_vector", query, {
        type: "websearch",
      });
    }

    if (categoryId) {
      listingsQuery = listingsQuery.eq("category_id", categoryId);
    }

    if (typeof minPrice === "number" && Number.isFinite(minPrice)) {
      listingsQuery = listingsQuery.gte("price_per_day", minPrice);
    }

    if (typeof maxPrice === "number" && Number.isFinite(maxPrice)) {
      listingsQuery = listingsQuery.lte("price_per_day", maxPrice);
    }

    if (city) {
      const escapedCity = city.replace(/[,%]/g, " ").trim();
      listingsQuery = listingsQuery.or(
        `city.ilike.%${escapedCity}%,state.ilike.%${escapedCity}%`,
      );
    }

    if (condition) {
      listingsQuery = listingsQuery.eq("condition", condition);
    }

    if (inStockOnly) {
      listingsQuery = listingsQuery.or("track_inventory.eq.false,quantity_available.gt.0");
    }

    switch (sortBy) {
      case "price_asc":
        listingsQuery = listingsQuery.order("price_per_day", {
          ascending: true,
          nullsFirst: false,
        });
        break;
      case "price_desc":
        listingsQuery = listingsQuery.order("price_per_day", {
          ascending: false,
          nullsFirst: false,
        });
        break;
      case "rating":
        listingsQuery = listingsQuery.order("views_count", { ascending: false });
        break;
      case "newest":
      default:
        listingsQuery = listingsQuery.order("created_at", { ascending: false });
        break;
    }

    const { data, count, error } = await listingsQuery.range(from, to);

    if (error) {
      throw error;
    }

    const totalCount = count ?? 0;
    const totalPages = totalCount > 0 ? Math.ceil(totalCount / pageSize) : 0;

    return {
      data: (data ?? []) as Listing[],
      totalCount,
      totalPages,
      currentPage,
    };
  } catch (error) {
    console.error("searchListings failed:", error);
    return {
      data: [],
      totalCount: 0,
      totalPages: 0,
      currentPage,
    };
  }
}
