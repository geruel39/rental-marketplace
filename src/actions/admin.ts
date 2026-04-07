"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

import { createNotification } from "@/actions/notifications";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency } from "@/lib/utils";
import type {
  ActionResponse,
  AdminAuditLog,
  AdminDashboardStats,
  AdminTargetType,
  Booking,
  BookingStatus,
  BookingWithDetails,
  Category,
  JsonObject,
  JsonValue,
  Listing,
  ListingStatus,
  ListingWithOwner,
  PaginatedResponse,
  Payout,
  PlatformSettings,
  Profile,
  Report,
  ReportStatus,
  ReportType,
  ReportWithDetails,
  Review,
  ReviewRole,
  ReviewWithUsers,
} from "@/types";

const DEFAULT_PER_PAGE = 20;
const MAX_PER_PAGE = 100;
const ACTIVE_BOOKING_STATUSES: BookingStatus[] = ["confirmed", "active"];

type AuditLogRow = AdminAuditLog & {
  admin: Profile;
};

type UserDetailResponse = {
  profile: Profile;
  listings: Listing[];
  bookings: Booking[];
  reviews: Review[];
  reports: Report[];
  payouts: Payout[];
};

type PayoutWithRelations = Payout & {
  lister: Profile;
  booking: Booking;
};

type BookingQueryRecord = Booking & {
  listing: Listing;
  renter: Profile;
  lister: Profile;
};

type ReviewAggregationRow = Pick<Review, "overall_rating">;

function getPagination(page?: number, perPage?: number) {
  const currentPage = Math.max(1, page ?? 1);
  const pageSize = Math.max(1, Math.min(perPage ?? DEFAULT_PER_PAGE, MAX_PER_PAGE));
  const from = (currentPage - 1) * pageSize;
  const to = from + pageSize - 1;

  return { currentPage, pageSize, from, to };
}

function buildPaginatedResponse<T>(
  data: T[],
  currentPage: number,
  pageSize: number,
  totalCount: number,
): PaginatedResponse<T> {
  return {
    data,
    totalCount,
    totalPages: totalCount === 0 ? 0 : Math.ceil(totalCount / pageSize),
    currentPage,
  };
}

function escapeLike(value: string) {
  return value.replace(/[%_,]/g, " ").trim();
}

function getMonthStartIso() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
}

function getRequestIp(
  headerStore: Awaited<ReturnType<typeof headers>>,
): string | null {
  const forwardedFor = headerStore.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() ?? null;
  }

  return (
    headerStore.get("x-real-ip") ??
    headerStore.get("cf-connecting-ip") ??
    null
  );
}

function revalidateAdminViews() {
  revalidatePath("/admin");
  revalidatePath("/admin/users");
  revalidatePath("/admin/listings");
  revalidatePath("/admin/bookings");
  revalidatePath("/admin/reviews");
  revalidatePath("/admin/payouts");
  revalidatePath("/admin/reports");
  revalidatePath("/admin/categories");
  revalidatePath("/admin/settings");
  revalidatePath("/admin/audit-log");
}

function sumNumbers(values: Array<number | null | undefined>): number {
  return values.reduce<number>((sum, value) => sum + (value ?? 0), 0);
}

async function callAdminRpc(
  fn: string,
  argsList: Record<string, unknown>[],
) {
  const admin = createAdminClient();
  let lastError: Error | null = null;

  for (const args of argsList) {
    const { error } = await admin.rpc(fn, args);

    if (!error) {
      return;
    }

    lastError = new Error(error.message);
  }

  throw lastError ?? new Error(`RPC ${fn} failed`);
}

async function releaseStockAsAdmin(
  booking: Pick<Booking, "id" | "listing_id" | "quantity">,
  adminId: string,
) {
  await callAdminRpc("release_stock", [
    {
      p_listing_id: booking.listing_id,
      p_booking_id: booking.id,
      p_quantity: booking.quantity,
      p_user_id: adminId,
    },
    {
      listing_id: booking.listing_id,
      booking_id: booking.id,
      quantity: booking.quantity,
      user_id: adminId,
    },
  ]);
}

async function returnStockAsAdmin(
  booking: Pick<Booking, "id" | "listing_id" | "quantity">,
  adminId: string,
) {
  await callAdminRpc("return_stock", [
    {
      p_listing_id: booking.listing_id,
      p_booking_id: booking.id,
      p_quantity: booking.quantity,
      p_user_id: adminId,
    },
    {
      listing_id: booking.listing_id,
      booking_id: booking.id,
      quantity: booking.quantity,
      user_id: adminId,
    },
  ]);
}

async function recalculateRevieweeRating(revieweeId: string, reviewRole: ReviewRole) {
  const admin = createAdminClient();
  const profileField =
    reviewRole === "as_renter"
      ? {
          average: "rating_as_lister",
          total: "total_reviews_as_lister",
        }
      : {
          average: "rating_as_renter",
          total: "total_reviews_as_renter",
        };

  const { data, error } = await admin
    .from("reviews")
    .select("overall_rating")
    .eq("reviewee_id", revieweeId)
    .eq("review_role", reviewRole)
    .eq("is_hidden", false);

  if (error) {
    throw error;
  }

  const rows = (data ?? []) as ReviewAggregationRow[];
  const totalReviews = rows.length;
  const averageRating =
    totalReviews === 0
      ? 0
      : rows.reduce((sum, review) => sum + review.overall_rating, 0) / totalReviews;

  const { error: profileError } = await admin
    .from("profiles")
    .update({
      [profileField.average]: Number(averageRating.toFixed(2)),
      [profileField.total]: totalReviews,
    })
    .eq("id", revieweeId);

  if (profileError) {
    throw profileError;
  }
}

async function getListingForModeration(listingId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("listings")
    .select("*")
    .eq("id", listingId)
    .maybeSingle<Listing>();

  if (error || !data) {
    throw new Error("Listing not found");
  }

  return data;
}

async function getBookingForAdmin(bookingId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("bookings")
    .select(
      `
        *,
        listing:listings!bookings_listing_id_fkey(*),
        renter:profiles!bookings_renter_id_fkey(*),
        lister:profiles!bookings_lister_id_fkey(*)
      `,
    )
    .eq("id", bookingId)
    .maybeSingle();

  if (error || !data) {
    throw new Error("Booking not found");
  }

  return data as BookingQueryRecord;
}

async function verifyAdmin(): Promise<{ adminId: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Unauthorized");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle<{ is_admin: boolean }>();

  if (!profile?.is_admin) {
    throw new Error("Unauthorized");
  }

  return { adminId: user.id };
}

async function logAdminAction(params: {
  adminId: string;
  action: string;
  targetType: AdminTargetType;
  targetId: string;
  details?: JsonObject;
}) {
  try {
    const admin = createAdminClient();
    const headerStore = await headers();
    const ipAddress = getRequestIp(headerStore);

    await admin.from("admin_audit_log").insert({
      admin_id: params.adminId,
      action: params.action,
      target_type: params.targetType,
      target_id: params.targetId,
      details: params.details ?? {},
      ip_address: ipAddress,
    });
  } catch (error) {
    console.error("logAdminAction failed:", error);
  }
}

export async function getAdminDashboardStats(): Promise<AdminDashboardStats> {
  const { adminId } = await verifyAdmin();
  void adminId;

  const admin = createAdminClient();
  const monthStart = getMonthStartIso();

  const [
    totalUsersResult,
    newUsersThisMonthResult,
    totalListingsResult,
    activeListingsResult,
    flaggedListingsResult,
    totalBookingsResult,
    activeBookingsResult,
    disputedBookingsResult,
    completedRevenueResult,
    monthRevenueResult,
    pendingPayoutCountResult,
    pendingPayoutRowsResult,
    openReportsResult,
    inventoryItemsResult,
  ] = await Promise.all([
    admin.from("profiles").select("id", { count: "exact", head: true }),
    admin
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .gte("created_at", monthStart),
    admin.from("listings").select("id", { count: "exact", head: true }),
    admin
      .from("listings")
      .select("id", { count: "exact", head: true })
      .eq("status", "active"),
    admin
      .from("listings")
      .select("id", { count: "exact", head: true })
      .eq("is_flagged", true),
    admin.from("bookings").select("id", { count: "exact", head: true }),
    admin
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .in("status", ACTIVE_BOOKING_STATUSES),
    admin
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("status", "disputed"),
    admin
      .from("bookings")
      .select("service_fee_renter, service_fee_lister")
      .eq("status", "completed"),
    admin
      .from("bookings")
      .select("service_fee_renter, service_fee_lister")
      .eq("status", "completed")
      .gte("updated_at", monthStart),
    admin
      .from("payouts")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
    admin
      .from("payouts")
      .select("amount")
      .eq("status", "pending"),
    admin
      .from("reports")
      .select("id", { count: "exact", head: true })
      .eq("status", "open"),
    admin
      .from("listings")
      .select("quantity_total")
      .eq("status", "active"),
  ]);

  const completedRevenueRows = (completedRevenueResult.data ?? []) as Array<{
    service_fee_renter: number | null;
    service_fee_lister: number | null;
  }>;
  const revenueThisMonthRows = (monthRevenueResult.data ?? []) as Array<{
    service_fee_renter: number | null;
    service_fee_lister: number | null;
  }>;
  const pendingPayoutRows = (pendingPayoutRowsResult.data ?? []) as Array<{
    amount: number | null;
  }>;
  const inventoryRows = (inventoryItemsResult.data ?? []) as Array<{
    quantity_total: number | null;
  }>;

  return {
    totalUsers: totalUsersResult.count ?? 0,
    newUsersThisMonth: newUsersThisMonthResult.count ?? 0,
    totalListings: totalListingsResult.count ?? 0,
    activeListings: activeListingsResult.count ?? 0,
    flaggedListings: flaggedListingsResult.count ?? 0,
    totalBookings: totalBookingsResult.count ?? 0,
    activeBookings: activeBookingsResult.count ?? 0,
    disputedBookings: disputedBookingsResult.count ?? 0,
    totalRevenue: completedRevenueRows.reduce(
      (sum, row) => sum + (row.service_fee_renter ?? 0) + (row.service_fee_lister ?? 0),
      0,
    ),
    revenueThisMonth: revenueThisMonthRows.reduce(
      (sum, row) => sum + (row.service_fee_renter ?? 0) + (row.service_fee_lister ?? 0),
      0,
    ),
    pendingPayouts: pendingPayoutCountResult.count ?? 0,
    pendingPayoutsAmount: sumNumbers(pendingPayoutRows.map((row) => row.amount)),
    openReports: openReportsResult.count ?? 0,
    totalInventoryItems: sumNumbers(
      inventoryRows.map((row) => row.quantity_total),
    ),
  };
}

export async function getAdminUsers(params: {
  search?: string;
  status?: "active" | "suspended" | "all";
  accountType?: "individual" | "business" | "all";
  page?: number;
  perPage?: number;
}): Promise<PaginatedResponse<Profile>> {
  await verifyAdmin();

  const admin = createAdminClient();
  const { currentPage, pageSize, from, to } = getPagination(params.page, params.perPage);

  let query = admin
    .from("profiles")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false });

  const searchTerm = escapeLike(params.search ?? "");
  if (searchTerm) {
    query = query.or(
      `email.ilike.%${searchTerm}%,full_name.ilike.%${searchTerm}%,display_name.ilike.%${searchTerm}%`,
    );
  }

  if (params.status === "active") {
    query = query.eq("is_suspended", false);
  } else if (params.status === "suspended") {
    query = query.eq("is_suspended", true);
  }

  if (params.accountType && params.accountType !== "all") {
    query = query.eq("account_type", params.accountType);
  }

  const { data, count, error } = await query.range(from, to);

  if (error) {
    throw error;
  }

  return buildPaginatedResponse(
    (data ?? []) as Profile[],
    currentPage,
    pageSize,
    count ?? 0,
  );
}

export async function getAdminUserDetail(userId: string): Promise<UserDetailResponse> {
  await verifyAdmin();

  const admin = createAdminClient();
  const [
    profileResult,
    listingsResult,
    bookingsResult,
    reviewsResult,
    reportsResult,
    payoutsResult,
  ] = await Promise.all([
    admin.from("profiles").select("*").eq("id", userId).maybeSingle<Profile>(),
    admin
      .from("listings")
      .select("*")
      .eq("owner_id", userId)
      .order("created_at", { ascending: false }),
    admin
      .from("bookings")
      .select("*")
      .or(`renter_id.eq.${userId},lister_id.eq.${userId}`)
      .order("created_at", { ascending: false }),
    admin
      .from("reviews")
      .select("*")
      .or(`reviewer_id.eq.${userId},reviewee_id.eq.${userId}`)
      .order("created_at", { ascending: false }),
    admin
      .from("reports")
      .select("*")
      .or(`reporter_id.eq.${userId},reported_user_id.eq.${userId}`)
      .order("created_at", { ascending: false }),
    admin
      .from("payouts")
      .select("*")
      .eq("lister_id", userId)
      .order("created_at", { ascending: false }),
  ]);

  if (profileResult.error || !profileResult.data) {
    throw new Error("User not found");
  }

  return {
    profile: profileResult.data,
    listings: (listingsResult.data ?? []) as Listing[],
    bookings: (bookingsResult.data ?? []) as Booking[],
    reviews: (reviewsResult.data ?? []) as Review[],
    reports: (reportsResult.data ?? []) as Report[],
    payouts: (payoutsResult.data ?? []) as Payout[],
  };
}

export async function suspendUser(
  userId: string,
  reason: string,
): Promise<ActionResponse> {
  try {
    const { adminId } = await verifyAdmin();
    const admin = createAdminClient();
    const trimmedReason = reason.trim();

    if (trimmedReason.length < 3) {
      return { error: "Suspension reason must be at least 3 characters" };
    }

    const suspendedAt = new Date().toISOString();

    const [{ error: profileError }, { error: listingsError }] = await Promise.all([
      admin
        .from("profiles")
        .update({
          is_suspended: true,
          suspended_at: suspendedAt,
          suspended_reason: trimmedReason,
          suspended_by: adminId,
        })
        .eq("id", userId),
      admin
        .from("listings")
        .update({ status: "paused" })
        .eq("owner_id", userId)
        .eq("status", "active"),
    ]);

    if (profileError) {
      throw profileError;
    }

    if (listingsError) {
      throw listingsError;
    }

    await logAdminAction({
      adminId,
      action: "suspend_user",
      targetType: "user",
      targetId: userId,
      details: { reason: trimmedReason },
    });

    revalidateAdminViews();
    return { success: "User suspended successfully" };
  } catch (error) {
    console.error("suspendUser failed:", error);
    return { error: error instanceof Error ? error.message : "Failed to suspend user" };
  }
}

export async function getPendingKYCVerifications(): Promise<{
  users: (Profile & { document_url: string })[];
  count: number;
}> {
  try {
    await verifyAdmin();

    const admin = createAdminClient();
    const { data, error } = await admin
      .from("profiles")
      .select("*")
      .eq("payout_method", "bank")
      .not("bank_kyc_document_url", "is", null)
      .eq("bank_kyc_verified", false)
      .order("updated_at", { ascending: true });

    if (error) {
      throw error;
    }

    const users = ((data ?? []) as Profile[]).map((profile) => ({
      ...profile,
      document_url: profile.bank_kyc_document_url ?? "",
    }));

    return {
      users,
      count: users.length,
    };
  } catch (error) {
    console.error("getPendingKYCVerifications failed:", error);
    return {
      users: [],
      count: 0,
    };
  }
}

export async function unsuspendUser(userId: string): Promise<ActionResponse> {
  try {
    const { adminId } = await verifyAdmin();
    const admin = createAdminClient();

    const { error } = await admin
      .from("profiles")
      .update({
        is_suspended: false,
        suspended_at: null,
        suspended_reason: null,
        suspended_by: null,
      })
      .eq("id", userId);

    if (error) {
      throw error;
    }

    await logAdminAction({
      adminId,
      action: "unsuspend_user",
      targetType: "user",
      targetId: userId,
    });

    revalidateAdminViews();
    return { success: "User unsuspended successfully" };
  } catch (error) {
    console.error("unsuspendUser failed:", error);
    return { error: error instanceof Error ? error.message : "Failed to unsuspend user" };
  }
}

export async function updateUserAdminNotes(
  userId: string,
  notes: string,
): Promise<ActionResponse> {
  try {
    const { adminId } = await verifyAdmin();
    const admin = createAdminClient();

    const { error } = await admin
      .from("profiles")
      .update({ admin_notes: notes.trim() || null })
      .eq("id", userId);

    if (error) {
      throw error;
    }

    await logAdminAction({
      adminId,
      action: "update_user_admin_notes",
      targetType: "user",
      targetId: userId,
      details: { notes: notes.trim() || null },
    });

    revalidateAdminViews();
    return { success: "Admin notes updated" };
  } catch (error) {
    console.error("updateUserAdminNotes failed:", error);
    return { error: error instanceof Error ? error.message : "Failed to update notes" };
  }
}

export async function toggleAdminRole(
  userId: string,
  isAdmin: boolean,
): Promise<ActionResponse> {
  try {
    const { adminId } = await verifyAdmin();

    if (adminId === userId && !isAdmin) {
      return { error: "You cannot remove your own admin role" };
    }

    const admin = createAdminClient();
    const { error } = await admin
      .from("profiles")
      .update({ is_admin: isAdmin })
      .eq("id", userId);

    if (error) {
      throw error;
    }

    await logAdminAction({
      adminId,
      action: isAdmin ? "grant_admin_role" : "revoke_admin_role",
      targetType: "user",
      targetId: userId,
      details: { is_admin: isAdmin },
    });

    revalidateAdminViews();
    return { success: "Admin role updated" };
  } catch (error) {
    console.error("toggleAdminRole failed:", error);
    return { error: error instanceof Error ? error.message : "Failed to update admin role" };
  }
}

export async function getAdminListings(params: {
  search?: string;
  status?: ListingStatus | "all";
  moderationStatus?: "pending" | "approved" | "rejected" | "flagged" | "all";
  flagged?: boolean;
  page?: number;
  perPage?: number;
}): Promise<PaginatedResponse<ListingWithOwner>> {
  await verifyAdmin();

  const admin = createAdminClient();
  const { currentPage, pageSize, from, to } = getPagination(params.page, params.perPage);

  let query = admin
    .from("listings")
    .select(
      `
        *,
        owner:profiles!listings_owner_id_fkey(*)
      `,
      { count: "exact" },
    )
    .order("created_at", { ascending: false });

  const searchTerm = escapeLike(params.search ?? "");
  if (searchTerm) {
    query = query.ilike("title", `%${searchTerm}%`);
  }

  if (params.status && params.status !== "all") {
    query = query.eq("status", params.status);
  }

  if (params.moderationStatus && params.moderationStatus !== "all") {
    query = query.eq("moderation_status", params.moderationStatus);
  }

  if (typeof params.flagged === "boolean") {
    query = query.eq("is_flagged", params.flagged);
  }

  const { data, count, error } = await query.range(from, to);

  if (error) {
    throw error;
  }

  return buildPaginatedResponse(
    (data ?? []) as ListingWithOwner[],
    currentPage,
    pageSize,
    count ?? 0,
  );
}

export async function moderateListing(
  listingId: string,
  action: "approve" | "reject" | "flag",
  notes?: string,
): Promise<ActionResponse> {
  try {
    const { adminId } = await verifyAdmin();
    const admin = createAdminClient();
    const listing = await getListingForModeration(listingId);
    const moderatedAt = new Date().toISOString();
    const trimmedNotes = notes?.trim() || null;

    const updates: Record<string, unknown> = {
      moderation_notes: trimmedNotes,
      moderated_by: adminId,
      moderated_at: moderatedAt,
    };

    if (action === "approve") {
      updates.moderation_status = "approved";
      updates.is_flagged = false;
      updates.flagged_reason = null;
    }

    if (action === "reject") {
      updates.moderation_status = "rejected";
      updates.status = "archived";
    }

    if (action === "flag") {
      updates.moderation_status = "flagged";
      updates.is_flagged = true;
      updates.flagged_reason = trimmedNotes;
      updates.flagged_by = adminId;
      updates.flagged_at = moderatedAt;
    }

    const { error } = await admin.from("listings").update(updates).eq("id", listingId);

    if (error) {
      throw error;
    }

    await createNotification({
      userId: listing.owner_id,
      type: "listing_moderated",
      title: `Your listing was ${action === "flag" ? "flagged" : `${action}d`}`,
      body:
        trimmedNotes ??
        `Your listing "${listing.title}" was reviewed by the admin team.`,
      listingId: listing.id,
      actionUrl: "/dashboard/my-listings",
    });

    await logAdminAction({
      adminId,
      action: `moderate_listing_${action}`,
      targetType: "listing",
      targetId: listingId,
      details: {
        moderation_status: updates.moderation_status as string,
        notes: trimmedNotes,
      },
    });

    revalidateAdminViews();
    revalidatePath("/dashboard/my-listings");
    revalidatePath(`/listings/${listing.id}`);
    return { success: "Listing moderation updated" };
  } catch (error) {
    console.error("moderateListing failed:", error);
    return { error: error instanceof Error ? error.message : "Failed to moderate listing" };
  }
}

export async function unflagListing(listingId: string): Promise<ActionResponse> {
  try {
    const { adminId } = await verifyAdmin();
    const admin = createAdminClient();

    const { error } = await admin
      .from("listings")
      .update({
        is_flagged: false,
        flagged_reason: null,
        moderation_status: "approved",
      })
      .eq("id", listingId);

    if (error) {
      throw error;
    }

    await logAdminAction({
      adminId,
      action: "unflag_listing",
      targetType: "listing",
      targetId: listingId,
    });

    revalidateAdminViews();
    return { success: "Listing unflagged" };
  } catch (error) {
    console.error("unflagListing failed:", error);
    return { error: error instanceof Error ? error.message : "Failed to unflag listing" };
  }
}

export async function getAdminBookings(params: {
  status?: BookingStatus | "all";
  disputed?: boolean;
  search?: string;
  page?: number;
  perPage?: number;
}): Promise<PaginatedResponse<BookingWithDetails>> {
  await verifyAdmin();

  const admin = createAdminClient();
  const { currentPage, pageSize, from, to } = getPagination(params.page, params.perPage);

  let query = admin
    .from("bookings")
    .select(
      `
        *,
        listing:listings!bookings_listing_id_fkey(*),
        renter:profiles!bookings_renter_id_fkey(*),
        lister:profiles!bookings_lister_id_fkey(*)
      `,
      { count: "exact" },
    )
    .order("created_at", { ascending: false });

  if (params.status && params.status !== "all") {
    query = query.eq("status", params.status);
  }

  if (params.disputed) {
    query = query.eq("status", "disputed");
  }

  const searchTerm = escapeLike(params.search ?? "");
  if (searchTerm) {
    const { data: matchingListings } = await admin
      .from("listings")
      .select("id")
      .ilike("title", `%${searchTerm}%`)
      .limit(100);

    const listingIds = (matchingListings ?? [])
      .map((row) => row.id)
      .filter(Boolean)
      .join(",");

    if (listingIds) {
      query = query.or(`id.ilike.%${searchTerm}%,listing_id.in.(${listingIds})`);
    } else {
      query = query.ilike("id", `%${searchTerm}%`);
    }
  }

  const { data, count, error } = await query.range(from, to);

  if (error) {
    throw error;
  }

  return buildPaginatedResponse(
    (data ?? []) as BookingWithDetails[],
    currentPage,
    pageSize,
    count ?? 0,
  );
}

export async function resolveDispute(
  bookingId: string,
  resolution: string,
  newStatus: BookingStatus,
): Promise<ActionResponse> {
  try {
    const { adminId } = await verifyAdmin();
    const admin = createAdminClient();
    const booking = await getBookingForAdmin(bookingId);
    const trimmedResolution = resolution.trim();

    if (trimmedResolution.length < 3) {
      return { error: "Resolution must be at least 3 characters" };
    }

    const updates: Record<string, unknown> = {
      dispute_resolved_by: adminId,
      dispute_resolved_at: new Date().toISOString(),
      dispute_resolution: trimmedResolution,
      status: newStatus,
    };

    if (newStatus === "completed") {
      if (booking.stock_deducted && !booking.stock_restored) {
        await returnStockAsAdmin(booking, adminId);
        updates.stock_restored = true;
      }
    } else if (booking.stock_deducted && !booking.stock_restored) {
      await releaseStockAsAdmin(booking, adminId);
      updates.stock_restored = true;
    }

    const { error } = await admin.from("bookings").update(updates).eq("id", bookingId);

    if (error) {
      throw error;
    }

    await Promise.all([
      createNotification({
        userId: booking.renter_id,
        type: "dispute_resolved",
        title: "Booking dispute resolved",
        body: trimmedResolution,
        bookingId: booking.id,
        listingId: booking.listing_id,
        fromUserId: adminId,
        actionUrl: "/dashboard/my-rentals",
      }),
      createNotification({
        userId: booking.lister_id,
        type: "dispute_resolved",
        title: "Booking dispute resolved",
        body: trimmedResolution,
        bookingId: booking.id,
        listingId: booking.listing_id,
        fromUserId: adminId,
        actionUrl: "/dashboard/requests",
      }),
    ]);

    await logAdminAction({
      adminId,
      action: "resolve_dispute",
      targetType: "booking",
      targetId: bookingId,
      details: {
        new_status: newStatus,
        resolution: trimmedResolution,
      },
    });

    revalidateAdminViews();
    revalidatePath("/dashboard/requests");
    revalidatePath("/dashboard/my-rentals");
    return { success: "Dispute resolved" };
  } catch (error) {
    console.error("resolveDispute failed:", error);
    return { error: error instanceof Error ? error.message : "Failed to resolve dispute" };
  }
}

export async function addBookingAdminNotes(
  bookingId: string,
  notes: string,
): Promise<ActionResponse> {
  try {
    const { adminId } = await verifyAdmin();
    const admin = createAdminClient();

    const { error } = await admin
      .from("bookings")
      .update({ admin_notes: notes.trim() || null })
      .eq("id", bookingId);

    if (error) {
      throw error;
    }

    await logAdminAction({
      adminId,
      action: "add_booking_admin_notes",
      targetType: "booking",
      targetId: bookingId,
      details: { notes: notes.trim() || null },
    });

    revalidateAdminViews();
    return { success: "Booking notes updated" };
  } catch (error) {
    console.error("addBookingAdminNotes failed:", error);
    return { error: error instanceof Error ? error.message : "Failed to update booking notes" };
  }
}

export async function getAdminPayouts(params: {
  status?: "pending" | "processing" | "completed" | "failed" | "all";
  page?: number;
  perPage?: number;
}): Promise<PaginatedResponse<PayoutWithRelations>> {
  await verifyAdmin();

  const admin = createAdminClient();
  const { currentPage, pageSize, from, to } = getPagination(params.page, params.perPage);

  let query = admin
    .from("payouts")
    .select(
      `
        *,
        lister:profiles!payouts_lister_id_fkey(*),
        booking:bookings!payouts_booking_id_fkey(*)
      `,
      { count: "exact" },
    )
    .order("created_at", { ascending: false });

  if (params.status && params.status !== "all") {
    query = query.eq("status", params.status);
  }

  const { data, count, error } = await query.range(from, to);

  if (error) {
    throw error;
  }

  return buildPaginatedResponse(
    (data ?? []) as PayoutWithRelations[],
    currentPage,
    pageSize,
    count ?? 0,
  );
}

export async function processPayout(
  payoutId: string,
  referenceNumber: string,
  method: string,
): Promise<ActionResponse> {
  try {
    const { adminId } = await verifyAdmin();
    const admin = createAdminClient();
    const { data: payout, error: payoutError } = await admin
      .from("payouts")
      .select(
        `
          *,
          lister:profiles!payouts_lister_id_fkey(*),
          booking:bookings!payouts_booking_id_fkey(*)
        `,
      )
      .eq("id", payoutId)
      .maybeSingle();

    if (payoutError || !payout) {
      throw new Error("Payout not found");
    }

    const processedAt = new Date().toISOString();
    const { error } = await admin
      .from("payouts")
      .update({
        status: "completed",
        processed_at: processedAt,
        processed_by: adminId,
        reference_number: referenceNumber.trim(),
        payout_method: method.trim(),
      })
      .eq("id", payoutId);

    if (error) {
      throw error;
    }

    const payoutRow = payout as Payout & {
      lister: Profile;
      booking: Booking | null;
    };

    if (payoutRow.booking_id) {
      await admin
        .from("bookings")
        .update({ payout_at: processedAt })
        .eq("id", payoutRow.booking_id);
    }

    await createNotification({
      userId: payoutRow.lister_id,
      type: "payout_processed",
      title: "Your payout has been processed",
      body: `Your payout of ${formatCurrency(payoutRow.amount, payoutRow.currency)} has been processed.`,
      bookingId: payoutRow.booking_id ?? undefined,
      fromUserId: adminId,
      actionUrl: "/dashboard/earnings",
    });

    await logAdminAction({
      adminId,
      action: "process_payout",
      targetType: "payout",
      targetId: payoutId,
      details: {
        reference_number: referenceNumber.trim(),
        payout_method: method.trim(),
        amount: payoutRow.amount,
      },
    });

    revalidateAdminViews();
    revalidatePath("/dashboard/earnings");
    return { success: "Payout processed" };
  } catch (error) {
    console.error("processPayout failed:", error);
    return { error: error instanceof Error ? error.message : "Failed to process payout" };
  }
}

export async function rejectPayout(
  payoutId: string,
  reason: string,
): Promise<ActionResponse> {
  try {
    const { adminId } = await verifyAdmin();
    const admin = createAdminClient();
    const { data: payout, error: payoutError } = await admin
      .from("payouts")
      .select("*")
      .eq("id", payoutId)
      .maybeSingle<Payout>();

    if (payoutError || !payout) {
      throw new Error("Payout not found");
    }

    const trimmedReason = reason.trim();
    const { error } = await admin
      .from("payouts")
      .update({
        status: "failed",
        notes: trimmedReason,
      })
      .eq("id", payoutId);

    if (error) {
      throw error;
    }

    await createNotification({
      userId: payout.lister_id,
      type: "payout_failed",
      title: "Payout could not be processed",
      body: trimmedReason,
      bookingId: payout.booking_id ?? undefined,
      fromUserId: adminId,
      actionUrl: "/dashboard/earnings",
    });

    await logAdminAction({
      adminId,
      action: "reject_payout",
      targetType: "payout",
      targetId: payoutId,
      details: { reason: trimmedReason },
    });

    revalidateAdminViews();
    return { success: "Payout rejected" };
  } catch (error) {
    console.error("rejectPayout failed:", error);
    return { error: error instanceof Error ? error.message : "Failed to reject payout" };
  }
}

export async function getAdminReviews(params: {
  flagged?: boolean;
  hidden?: boolean;
  page?: number;
  perPage?: number;
}): Promise<PaginatedResponse<ReviewWithUsers>> {
  await verifyAdmin();

  const admin = createAdminClient();
  const { currentPage, pageSize, from, to } = getPagination(params.page, params.perPage);

  let query = admin
    .from("reviews")
    .select(
      `
        *,
        reviewer:profiles!reviews_reviewer_id_fkey(*),
        reviewee:profiles!reviews_reviewee_id_fkey(*),
        listing:listings(*)
      `,
      { count: "exact" },
    )
    .order("created_at", { ascending: false });

  if (typeof params.flagged === "boolean") {
    query = query.eq("is_flagged", params.flagged);
  }

  if (typeof params.hidden === "boolean") {
    query = query.eq("is_hidden", params.hidden);
  }

  const { data, count, error } = await query.range(from, to);

  if (error) {
    throw error;
  }

  return buildPaginatedResponse(
    (data ?? []) as ReviewWithUsers[],
    currentPage,
    pageSize,
    count ?? 0,
  );
}

export async function hideReview(
  reviewId: string,
  reason: string,
): Promise<ActionResponse> {
  try {
    const { adminId } = await verifyAdmin();
    const admin = createAdminClient();
    const { data: review, error: reviewError } = await admin
      .from("reviews")
      .select("*")
      .eq("id", reviewId)
      .maybeSingle<Review>();

    if (reviewError || !review) {
      throw new Error("Review not found");
    }

    const trimmedReason = reason.trim();
    const { error } = await admin
      .from("reviews")
      .update({
        is_hidden: true,
        moderated_by: adminId,
        flagged_reason: trimmedReason,
      })
      .eq("id", reviewId);

    if (error) {
      throw error;
    }

    await recalculateRevieweeRating(review.reviewee_id, review.review_role);

    await logAdminAction({
      adminId,
      action: "hide_review",
      targetType: "review",
      targetId: reviewId,
      details: { reason: trimmedReason },
    });

    revalidateAdminViews();
    revalidatePath("/dashboard/reviews");
    return { success: "Review hidden" };
  } catch (error) {
    console.error("hideReview failed:", error);
    return { error: error instanceof Error ? error.message : "Failed to hide review" };
  }
}

export async function unhideReview(reviewId: string): Promise<ActionResponse> {
  try {
    const { adminId } = await verifyAdmin();
    const admin = createAdminClient();
    const { data: review, error: reviewError } = await admin
      .from("reviews")
      .select("*")
      .eq("id", reviewId)
      .maybeSingle<Review>();

    if (reviewError || !review) {
      throw new Error("Review not found");
    }

    const { error } = await admin
      .from("reviews")
      .update({
        is_hidden: false,
      })
      .eq("id", reviewId);

    if (error) {
      throw error;
    }

    await recalculateRevieweeRating(review.reviewee_id, review.review_role);

    await logAdminAction({
      adminId,
      action: "unhide_review",
      targetType: "review",
      targetId: reviewId,
    });

    revalidateAdminViews();
    return { success: "Review restored" };
  } catch (error) {
    console.error("unhideReview failed:", error);
    return { error: error instanceof Error ? error.message : "Failed to restore review" };
  }
}

export async function flagReview(
  reviewId: string,
  reason: string,
): Promise<ActionResponse> {
  try {
    const { adminId } = await verifyAdmin();
    const admin = createAdminClient();

    const { error } = await admin
      .from("reviews")
      .update({
        is_flagged: true,
        flagged_reason: reason.trim() || null,
        moderated_by: adminId,
      })
      .eq("id", reviewId);

    if (error) {
      throw error;
    }

    await logAdminAction({
      adminId,
      action: "flag_review",
      targetType: "review",
      targetId: reviewId,
      details: { reason: reason.trim() || null },
    });

    revalidateAdminViews();
    return { success: "Review flagged" };
  } catch (error) {
    console.error("flagReview failed:", error);
    return { error: error instanceof Error ? error.message : "Failed to flag review" };
  }
}

export async function unflagReview(reviewId: string): Promise<ActionResponse> {
  try {
    const { adminId } = await verifyAdmin();
    const admin = createAdminClient();

    const { error } = await admin
      .from("reviews")
      .update({
        is_flagged: false,
        flagged_reason: null,
      })
      .eq("id", reviewId);

    if (error) {
      throw error;
    }

    await logAdminAction({
      adminId,
      action: "unflag_review",
      targetType: "review",
      targetId: reviewId,
    });

    revalidateAdminViews();
    return { success: "Review unflagged" };
  } catch (error) {
    console.error("unflagReview failed:", error);
    return { error: error instanceof Error ? error.message : "Failed to unflag review" };
  }
}

export async function getAdminReports(params: {
  status?: ReportStatus | "all";
  type?: ReportType | "all";
  page?: number;
  perPage?: number;
}): Promise<PaginatedResponse<ReportWithDetails>> {
  await verifyAdmin();

  const admin = createAdminClient();
  const { currentPage, pageSize, from, to } = getPagination(params.page, params.perPage);

  let query = admin
    .from("reports")
    .select(
      `
        *,
        reporter:profiles!reports_reporter_id_fkey(*),
        reported_user:profiles!reports_reported_user_id_fkey(*),
        reported_listing:listings!reports_reported_listing_id_fkey(*),
        reported_review:reviews!reports_reported_review_id_fkey(*)
      `,
      { count: "exact" },
    )
    .order("created_at", { ascending: false });

  if (params.status && params.status !== "all") {
    query = query.eq("status", params.status);
  }

  if (params.type && params.type !== "all") {
    query = query.eq("report_type", params.type);
  }

  const { data, count, error } = await query.range(from, to);

  if (error) {
    throw error;
  }

  return buildPaginatedResponse(
    (data ?? []) as ReportWithDetails[],
    currentPage,
    pageSize,
    count ?? 0,
  );
}

export async function resolveReport(
  reportId: string,
  resolution: "resolved" | "dismissed",
  notes: string,
): Promise<ActionResponse> {
  try {
    const { adminId } = await verifyAdmin();
    const admin = createAdminClient();
    const trimmedNotes = notes.trim();

    const { error } = await admin
      .from("reports")
      .update({
        status: resolution,
        admin_notes: trimmedNotes,
        resolved_by: adminId,
        resolved_at: new Date().toISOString(),
      })
      .eq("id", reportId);

    if (error) {
      throw error;
    }

    await logAdminAction({
      adminId,
      action: "resolve_report",
      targetType: "report",
      targetId: reportId,
      details: {
        resolution,
        notes: trimmedNotes,
      },
    });

    revalidateAdminViews();
    return { success: "Report updated" };
  } catch (error) {
    console.error("resolveReport failed:", error);
    return { error: error instanceof Error ? error.message : "Failed to resolve report" };
  }
}

export async function updateReportStatus(
  reportId: string,
  status: ReportStatus,
  notes?: string,
): Promise<ActionResponse> {
  try {
    const { adminId } = await verifyAdmin();
    const admin = createAdminClient();

    const updates: Record<string, unknown> = {
      status,
      admin_notes: notes?.trim() || null,
    };

    if (status === "resolved" || status === "dismissed") {
      updates.resolved_by = adminId;
      updates.resolved_at = new Date().toISOString();
    }

    const { error } = await admin.from("reports").update(updates).eq("id", reportId);

    if (error) {
      throw error;
    }

    await logAdminAction({
      adminId,
      action: "update_report_status",
      targetType: "report",
      targetId: reportId,
      details: {
        status,
        notes: notes?.trim() || null,
      },
    });

    revalidateAdminViews();
    return { success: "Report status updated" };
  } catch (error) {
    console.error("updateReportStatus failed:", error);
    return { error: error instanceof Error ? error.message : "Failed to update report status" };
  }
}

export async function createCategory(data: {
  name: string;
  slug: string;
  icon: string | null;
  description: string | null;
  parentId?: string | null;
  sortOrder: number;
}): Promise<ActionResponse> {
  try {
    const { adminId } = await verifyAdmin();
    const admin = createAdminClient();

    const { error } = await admin.from("categories").insert({
      name: data.name.trim(),
      slug: data.slug.trim(),
      icon: data.icon ?? null,
      description: data.description ?? null,
      parent_id: data.parentId ?? null,
      sort_order: data.sortOrder,
    });

    if (error) {
      throw error;
    }

    await logAdminAction({
      adminId,
      action: "create_category",
      targetType: "category",
      targetId: data.slug.trim(),
      details: {
        name: data.name.trim(),
        parent_id: data.parentId ?? null,
      },
    });

    revalidateAdminViews();
    revalidatePath("/");
    return { success: "Category created" };
  } catch (error) {
    console.error("createCategory failed:", error);
    return { error: error instanceof Error ? error.message : "Failed to create category" };
  }
}

export async function updateCategory(
  categoryId: string,
  data: Partial<Category>,
): Promise<ActionResponse> {
  try {
    const { adminId } = await verifyAdmin();
    const admin = createAdminClient();
    const updates: Record<string, unknown> = {};

    if (typeof data.name === "string") updates.name = data.name.trim();
    if (typeof data.slug === "string") updates.slug = data.slug.trim();
    if ("icon" in data) updates.icon = data.icon ?? null;
    if ("description" in data) updates.description = data.description ?? null;
    if ("parent_id" in data) updates.parent_id = data.parent_id ?? null;
    if (typeof data.sort_order === "number") updates.sort_order = data.sort_order;
    if (typeof data.is_active === "boolean") updates.is_active = data.is_active;

    const { error } = await admin.from("categories").update(updates).eq("id", categoryId);

    if (error) {
      throw error;
    }

    await logAdminAction({
      adminId,
      action: "update_category",
      targetType: "category",
      targetId: categoryId,
      details: updates as JsonObject,
    });

    revalidateAdminViews();
    revalidatePath("/");
    return { success: "Category updated" };
  } catch (error) {
    console.error("updateCategory failed:", error);
    return { error: error instanceof Error ? error.message : "Failed to update category" };
  }
}

export async function toggleCategoryActive(
  categoryId: string,
): Promise<ActionResponse> {
  try {
    const { adminId } = await verifyAdmin();
    const admin = createAdminClient();
    const { data: category, error: categoryError } = await admin
      .from("categories")
      .select("is_active")
      .eq("id", categoryId)
      .maybeSingle<{ is_active: boolean }>();

    if (categoryError || !category) {
      throw new Error("Category not found");
    }

    const nextValue = !category.is_active;
    const { error } = await admin
      .from("categories")
      .update({ is_active: nextValue })
      .eq("id", categoryId);

    if (error) {
      throw error;
    }

    await logAdminAction({
      adminId,
      action: "toggle_category_active",
      targetType: "category",
      targetId: categoryId,
      details: { is_active: nextValue },
    });

    revalidateAdminViews();
    revalidatePath("/");
    return { success: "Category status updated" };
  } catch (error) {
    console.error("toggleCategoryActive failed:", error);
    return { error: error instanceof Error ? error.message : "Failed to toggle category" };
  }
}

export async function getPlatformSettings(): Promise<PlatformSettings> {
  await verifyAdmin();

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("platform_settings")
    .select("key, value");

  if (error) {
    throw error;
  }

  return (data ?? []).reduce<PlatformSettings>((acc, row) => {
    acc[row.key] = row.value as JsonValue;
    return acc;
  }, {});
}

export async function updatePlatformSetting(
  key: string,
  value: JsonValue,
): Promise<ActionResponse> {
  try {
    const { adminId } = await verifyAdmin();
    const admin = createAdminClient();
    const trimmedKey = key.trim();

    const { error } = await admin.from("platform_settings").upsert(
      {
        key: trimmedKey,
        value,
      },
      { onConflict: "key" },
    );

    if (error) {
      throw error;
    }

    await logAdminAction({
      adminId,
      action: "update_platform_setting",
      targetType: "settings",
      targetId: trimmedKey,
      details: { value },
    });

    revalidateAdminViews();
    return { success: "Platform setting updated" };
  } catch (error) {
    console.error("updatePlatformSetting failed:", error);
    return { error: error instanceof Error ? error.message : "Failed to update setting" };
  }
}

export async function getAuditLog(params: {
  adminId?: string;
  targetType?: AdminTargetType | "all";
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  perPage?: number;
}): Promise<PaginatedResponse<AuditLogRow>> {
  await verifyAdmin();

  const admin = createAdminClient();
  const { currentPage, pageSize, from, to } = getPagination(params.page, params.perPage);

  let query = admin
    .from("admin_audit_log")
    .select(
      `
        *,
        admin:profiles!admin_audit_log_admin_id_fkey(*)
      `,
      { count: "exact" },
    )
    .order("created_at", { ascending: false });

  if (params.adminId) {
    query = query.eq("admin_id", params.adminId);
  }

  if (params.targetType && params.targetType !== "all") {
    query = query.eq("target_type", params.targetType);
  }

  if (params.dateFrom) {
    query = query.gte("created_at", new Date(params.dateFrom).toISOString());
  }

  if (params.dateTo) {
    const dateTo = new Date(params.dateTo);
    dateTo.setHours(23, 59, 59, 999);
    query = query.lte("created_at", dateTo.toISOString());
  }

  const { data, count, error } = await query.range(from, to);

  if (error) {
    throw error;
  }

  return buildPaginatedResponse(
    (data ?? []) as AuditLogRow[],
    currentPage,
    pageSize,
    count ?? 0,
  );
}
