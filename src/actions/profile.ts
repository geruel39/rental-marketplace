"use server";

import { startOfMonth } from "date-fns";

import { getIncomingBookings, getMyRentals } from "@/actions/bookings";
import { getInventoryOverview, getLowStockListings } from "@/actions/inventory";
import { getNotifications } from "@/actions/notifications";
import { getPendingReviews } from "@/actions/reviews";
import { createClient } from "@/lib/supabase/server";
import {
  payoutMethodSchema,
  profileUpdateSchema,
} from "@/lib/validations";
import type {
  ActionResponse,
  DashboardStats,
  Listing,
  PaginatedResponse,
  Payout,
  Profile,
} from "@/types";

const USER_LISTINGS_PER_PAGE = 8;
const AVATARS_BUCKET = "avatars";

function normalizePhilippinePhone(phone: string) {
  const digits = phone.replace(/\D/g, "");

  if (digits.startsWith("63")) {
    return `0${digits.slice(2)}`;
  }

  if (digits.startsWith("0")) {
    return digits;
  }

  return `0${digits}`;
}

function getPagination(page?: number, perPage = USER_LISTINGS_PER_PAGE) {
  const currentPage = Math.max(1, page ?? 1);
  const from = (currentPage - 1) * perPage;
  const to = from + perPage - 1;

  return { currentPage, from, to, perPage };
}

function sanitizeFilename(filename: string) {
  return filename.replace(/[^a-zA-Z0-9._-]/g, "-");
}

async function uploadAvatar(userId: string, file: File) {
  const supabase = await createClient();
  const filePath = `${userId}/${crypto.randomUUID()}-${sanitizeFilename(file.name)}`;
  const fileBuffer = await file.arrayBuffer();

  const { error: uploadError } = await supabase.storage
    .from(AVATARS_BUCKET)
    .upload(filePath, fileBuffer, {
      contentType: file.type,
      upsert: true,
    });

  if (uploadError) {
    throw new Error(uploadError.message);
  }

  const { data } = supabase.storage.from(AVATARS_BUCKET).getPublicUrl(filePath);
  return data.publicUrl;
}

export async function getPublicProfile(userId: string): Promise<{
  profile: Profile;
  listingsCount: number;
  reviewsAsListerCount: number;
  reviewsAsRenterCount: number;
} | null> {
  try {
    const supabase = await createClient();
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle<Profile>();

    if (profileError) {
      throw profileError;
    }

    if (!profile) {
      return null;
    }

    const [
      { count: listingsCount, error: listingsError },
      { count: reviewsAsListerCount, error: listerReviewsError },
      { count: reviewsAsRenterCount, error: renterReviewsError },
    ] = await Promise.all([
      supabase
        .from("listings")
        .select("id", { count: "exact", head: true })
        .eq("owner_id", userId)
        .eq("status", "active"),
      supabase
        .from("reviews")
        .select("id", { count: "exact", head: true })
        .eq("reviewee_id", userId)
        .eq("review_role", "as_renter"),
      supabase
        .from("reviews")
        .select("id", { count: "exact", head: true })
        .eq("reviewee_id", userId)
        .eq("review_role", "as_lister"),
    ]);

    if (listingsError || listerReviewsError || renterReviewsError) {
      throw listingsError || listerReviewsError || renterReviewsError;
    }

    return {
      profile,
      listingsCount: listingsCount ?? 0,
      reviewsAsListerCount: reviewsAsListerCount ?? 0,
      reviewsAsRenterCount: reviewsAsRenterCount ?? 0,
    };
  } catch (error) {
    console.error("getPublicProfile failed:", error);
    return null;
  }
}

export async function getUserListings(
  userId: string,
  page?: number,
): Promise<PaginatedResponse<Listing>> {
  try {
    const supabase = await createClient();
    const { currentPage, from, to, perPage } = getPagination(page);

    const { data, error, count } = await supabase
      .from("listings")
      .select("*", { count: "exact" })
      .eq("owner_id", userId)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .range(from, to);

    if (error) {
      throw error;
    }

    return {
      data: (data ?? []) as Listing[],
      totalCount: count ?? 0,
      totalPages: Math.max(1, Math.ceil((count ?? 0) / perPage)),
      currentPage,
    };
  } catch (error) {
    console.error("getUserListings failed:", error);
    return {
      data: [],
      totalCount: 0,
      totalPages: 0,
      currentPage: Math.max(1, page ?? 1),
    };
  }
}

export async function updateProfile(
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
      return { error: "You must be signed in" };
    }

    const avatarFile = formData.get("avatar");
    let avatarUrl: string | undefined;

    if (avatarFile instanceof File && avatarFile.size > 0) {
      avatarUrl = await uploadAvatar(user.id, avatarFile);
    }

    const parsed = profileUpdateSchema.safeParse({
      full_name: formData.get("full_name")?.toString().trim() || undefined,
      display_name: formData.get("display_name")?.toString().trim() || undefined,
      bio: formData.get("bio")?.toString().trim() || undefined,
      phone: formData.get("phone")?.toString().trim() || undefined,
      location: formData.get("location")?.toString().trim() || undefined,
      city: formData.get("city")?.toString().trim() || undefined,
      state: formData.get("state")?.toString().trim() || undefined,
      country: formData.get("country")?.toString().trim() || undefined,
      website_url: formData.get("website_url")?.toString().trim() || "",
    });

    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Invalid profile data" };
    }

    const updatePayload = {
      full_name: parsed.data.full_name ?? null,
      display_name: parsed.data.display_name ?? null,
      bio: parsed.data.bio ?? null,
      phone: parsed.data.phone ?? null,
      location: parsed.data.location ?? null,
      city: parsed.data.city ?? null,
      state: parsed.data.state ?? null,
      country: parsed.data.country ?? null,
      website_url: parsed.data.website_url || null,
      ...(avatarUrl ? { avatar_url: avatarUrl } : {}),
    };

    const { error } = await supabase
      .from("profiles")
      .update(updatePayload)
      .eq("id", user.id);

    if (error) {
      console.error("updateProfile profile update failed:", error);
      return { error: "Could not save your profile. Please try again." };
    }

    const { error: authUpdateError } = await supabase.auth.updateUser({
      data: {
        avatar_url: avatarUrl ?? user.user_metadata.avatar_url ?? null,
        display_name:
          parsed.data.display_name ?? user.user_metadata.display_name ?? null,
        full_name: parsed.data.full_name ?? user.user_metadata.full_name ?? null,
      },
    });

    if (authUpdateError) {
      console.error("updateProfile auth sync failed:", authUpdateError);
      return { error: "Could not save your profile. Please try again." };
    }

    return { success: "Profile updated" };
  } catch (error) {
    console.error("updateProfile failed:", error);
    return { error: "Something went wrong. Please try again." };
  }
}

export async function updatePayoutSettings(
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
      return { error: "You must be signed in" };
    }

    const bankName = formData.get("bank_name")?.toString().trim() || undefined;
    const bankAccountNumber =
      formData.get("bank_account_number")?.toString().trim() ||
      formData.get("account_number")?.toString().trim() ||
      undefined;
    const bankAccountName =
      formData.get("bank_account_name")?.toString().trim() ||
      formData.get("account_holder")?.toString().trim() ||
      undefined;
    const gcashPhoneNumber =
      formData.get("gcash_phone_number")?.toString().trim() || undefined;
    const mayaPhoneNumber =
      formData.get("maya_phone_number")?.toString().trim() || undefined;
    const submittedMethod = formData.get("method")?.toString().trim();

    const inferredMethod =
      submittedMethod ||
      (gcashPhoneNumber
        ? "gcash"
        : mayaPhoneNumber
          ? "maya"
          : bankName || bankAccountNumber || bankAccountName
            ? "bank"
            : undefined);

    if (!inferredMethod) {
      return { error: "Select a payout method and complete the required details" };
    }

    const parsed = payoutMethodSchema.safeParse({
      method: inferredMethod,
      bank_name: bankName,
      bank_account_number: bankAccountNumber,
      bank_account_name: bankAccountName,
      gcash_phone_number: gcashPhoneNumber,
      maya_phone_number: mayaPhoneNumber,
    });

    if (!parsed.success) {
      return {
        error: parsed.error.issues[0]?.message ?? "Invalid payout settings",
      };
    }

    if (parsed.data.method === "gcash" && parsed.data.gcash_phone_number) {
      parsed.data.gcash_phone_number = normalizePhilippinePhone(
        parsed.data.gcash_phone_number,
      );
    }

    if (parsed.data.method === "maya" && parsed.data.maya_phone_number) {
      parsed.data.maya_phone_number = normalizePhilippinePhone(
        parsed.data.maya_phone_number,
      );
    }

    const { error } = await supabase
      .from("profiles")
      .update({
        payout_method: parsed.data.method,
        bank_name: parsed.data.method === "bank" ? parsed.data.bank_name ?? null : null,
        bank_account_number:
          parsed.data.method === "bank"
            ? parsed.data.bank_account_number ?? null
            : null,
        bank_account_name:
          parsed.data.method === "bank"
            ? parsed.data.bank_account_name ?? null
            : null,
        gcash_phone_number:
          parsed.data.method === "gcash"
            ? parsed.data.gcash_phone_number ?? null
            : null,
        maya_phone_number:
          parsed.data.method === "maya" ? parsed.data.maya_phone_number ?? null : null,
        payout_setup_completed: true,
        payout_setup_completed_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    if (error) {
      console.error("updatePayoutSettings update failed:", error);
      if (error.code === "23505") {
        return { error: "That payout account is already being used by another user." };
      }
      return { error: "Could not save payout settings. Please try again." };
    }

    return { success: "Payout settings saved" };
  } catch (error) {
    console.error("updatePayoutSettings failed:", error);
    return { error: "Something went wrong. Please try again." };
  }
}

export async function sendVerificationEmail(): Promise<ActionResponse> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user?.email) {
      return { error: "You must be signed in" };
    }

    const { error } = await supabase.auth.resend({
      type: "signup",
      email: user.email,
    });

    if (error) {
      console.error("sendVerificationEmail failed:", error);
      return { error: "Could not send the verification email. Please try again." };
    }

    return { success: "Verification email sent" };
  } catch (error) {
    console.error("sendVerificationEmail failed:", error);
    return { error: "Something went wrong. Please try again." };
  }
}

export async function getPayoutsForUser(userId: string): Promise<Payout[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("payouts")
      .select("*")
      .eq("lister_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      throw error;
    }

    return (data ?? []) as Payout[];
  } catch (error) {
    console.error("getPayoutsForUser failed:", error);
    return [];
  }
}

export async function getDashboardStats(userId: string): Promise<DashboardStats> {
  const monthStart = startOfMonth(new Date()).toISOString();

  try {
    const supabase = await createClient();

    const [
    { count: activeListingsCount, error: activeListingsError },
    { count: pendingListerRequestsCount, error: pendingListerRequestsError },
    { data: reservedItemsData, error: reservedItemsError },
    { data: earningsData, error: earningsError },
    inventoryOverview,
    lowStockListings,
    { count: activeRentalsCount, error: activeRentalsError },
    { count: pendingRenterRequestsCount, error: pendingRenterRequestsError },
    { count: completedRentalsCount, error: completedRentalsError },
    incomingRequests,
    outgoingRentals,
    latestNotifications,
    pendingReviews,
    ] = await Promise.all([
    supabase
      .from("listings")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", userId)
      .eq("status", "active"),
    supabase
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("lister_id", userId)
      .eq("status", "pending"),
    supabase
      .from("listings")
      .select("quantity_reserved")
      .eq("owner_id", userId),
    supabase
      .from("bookings")
      .select("lister_payout")
      .eq("lister_id", userId)
      .eq("status", "completed")
      .gte("payout_at", monthStart),
    getInventoryOverview(userId),
    getLowStockListings(userId),
    supabase
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("renter_id", userId)
      .in("status", ["confirmed", "active"]),
    supabase
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("renter_id", userId)
      .eq("status", "pending"),
    supabase
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("renter_id", userId)
      .eq("status", "completed"),
    getIncomingBookings(userId),
    getMyRentals(userId),
    getNotifications(userId, 1),
    getPendingReviews(userId),
  ]);

    const queryError =
      activeListingsError ||
      pendingListerRequestsError ||
      reservedItemsError ||
      earningsError ||
      activeRentalsError ||
      pendingRenterRequestsError ||
      completedRentalsError;

    if (queryError) {
      throw queryError;
    }

  const itemsRentedOut = (reservedItemsData ?? []).reduce(
    (sum, listing) => sum + (listing.quantity_reserved ?? 0),
    0,
  );
  const earningsThisMonth = (earningsData ?? []).reduce(
    (sum, booking) => sum + (booking.lister_payout ?? 0),
    0,
  );
  const pendingReviewsAsRenter = pendingReviews.filter(
    (booking) => booking.renter_id === userId,
  ).length;
  const pendingReviewsAsLister = pendingReviews.filter(
    (booking) => booking.lister_id === userId,
  ).length;

    return {
    lister: {
      totalListings: inventoryOverview.summary.totalListings,
      activeListings: activeListingsCount ?? 0,
      totalBookings: incomingRequests.length,
      pendingRequests: pendingListerRequestsCount ?? 0,
      activeRentals: incomingRequests.filter(
        (booking) => booking.status === "confirmed" || booking.status === "active",
      ).length,
      completedBookings: incomingRequests.filter((booking) => booking.status === "completed")
        .length,
      totalEarnings: earningsThisMonth,
      averageRating: 0,
      itemsRentedOut,
      earningsThisMonth,
      inventorySummary: inventoryOverview.summary,
      lowStockListings,
      recentIncomingRequests: incomingRequests.slice(0, 5),
    },
    renter: {
      totalBookings: outgoingRentals.length,
      pendingBookings: pendingRenterRequestsCount ?? 0,
      activeRentals: activeRentalsCount ?? 0,
      completedRentals: completedRentalsCount ?? 0,
      totalSpent: outgoingRentals
        .filter((booking) => booking.hitpay_payment_status === "completed")
        .reduce((sum, booking) => sum + booking.total_price, 0),
      favoritesCount: 0,
      averageRating: 0,
      pendingRequests: pendingRenterRequestsCount ?? 0,
      recentRentals: outgoingRentals.slice(0, 5),
    },
    notifications: latestNotifications.data.slice(0, 5),
    pendingReviewsCount: pendingReviews.length,
    pendingReviewsAsLister,
    pendingReviewsAsRenter,
    };
  } catch (error) {
    console.error("getDashboardStats failed:", error);
    return {
      lister: {
        totalListings: 0,
        activeListings: 0,
        totalBookings: 0,
        pendingRequests: 0,
        activeRentals: 0,
        completedBookings: 0,
        totalEarnings: 0,
        averageRating: 0,
        itemsRentedOut: 0,
        earningsThisMonth: 0,
        inventorySummary: {
          totalListings: 0,
          inStockCount: 0,
          lowStockCount: 0,
          outOfStockCount: 0,
          totalItemsAvailable: 0,
          totalItemsReserved: 0,
        },
        lowStockListings: [],
        recentIncomingRequests: [],
      },
      renter: {
        totalBookings: 0,
        pendingBookings: 0,
        activeRentals: 0,
        completedRentals: 0,
        totalSpent: 0,
        favoritesCount: 0,
        averageRating: 0,
        pendingRequests: 0,
        recentRentals: [],
      },
      notifications: [],
      pendingReviewsCount: 0,
      pendingReviewsAsLister: 0,
      pendingReviewsAsRenter: 0,
    };
  }
}
