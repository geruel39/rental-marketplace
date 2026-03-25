"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { reviewSchema } from "@/lib/validations";
import type {
  ActionResponse,
  Booking,
  BookingWithDetails,
  PaginatedResponse,
  ReviewRole,
  ReviewWithUsers,
} from "@/types";

const REVIEWS_PER_PAGE = 10;

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function getPagination(page?: number) {
  const currentPage = Math.max(1, page ?? 1);
  const from = (currentPage - 1) * REVIEWS_PER_PAGE;
  const to = from + REVIEWS_PER_PAGE - 1;

  return { currentPage, from, to };
}

async function getCurrentUserContext() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("You must be signed in");
  }

  return { supabase, user };
}

async function createReviewNotification({
  userId,
  bookingId,
  listingId,
}: {
  userId: string;
  bookingId: string;
  listingId: string;
}) {
  const admin = createAdminClient();
  const { error } = await admin.from("notifications").insert({
    user_id: userId,
    type: "new_review",
    title: "You received a new review",
    booking_id: bookingId,
    listing_id: listingId,
    action_url: "/dashboard/reviews",
  });

  if (error) {
    throw new Error(error.message);
  }
}

export async function submitReview(
  prevState: ActionResponse | null,
  formData: FormData,
): Promise<ActionResponse> {
  void prevState;

  try {
    const { supabase, user } = await getCurrentUserContext();
    const parsed = reviewSchema.safeParse({
      booking_id: formData.get("booking_id"),
      overall_rating: formData.get("overall_rating"),
      communication_rating: formData.get("communication_rating") || undefined,
      accuracy_rating: formData.get("accuracy_rating") || undefined,
      condition_rating: formData.get("condition_rating") || undefined,
      value_rating: formData.get("value_rating") || undefined,
      comment: formData.get("comment")?.toString().trim() || undefined,
    });

    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Invalid review" };
    }

    const { data: booking, error: bookingError } = await supabase
      .from("bookings")
      .select("*")
      .eq("id", parsed.data.booking_id)
      .maybeSingle<Booking>();

    if (bookingError || !booking) {
      return { error: "Booking not found" };
    }

    if (booking.status !== "completed") {
      return { error: "Reviews can only be submitted for completed bookings" };
    }

    let reviewRole: ReviewRole;
    let revieweeId: string;
    let reviewFlagField: "renter_reviewed" | "lister_reviewed";

    if (user.id === booking.renter_id) {
      reviewRole = "as_renter";
      revieweeId = booking.lister_id;
      reviewFlagField = "renter_reviewed";
    } else if (user.id === booking.lister_id) {
      reviewRole = "as_lister";
      revieweeId = booking.renter_id;
      reviewFlagField = "lister_reviewed";
    } else {
      return { error: "You cannot review this booking" };
    }

    const { data: existingReview, error: existingReviewError } = await supabase
      .from("reviews")
      .select("id")
      .eq("booking_id", booking.id)
      .eq("reviewer_id", user.id)
      .eq("review_role", reviewRole)
      .maybeSingle<{ id: string }>();

    if (existingReviewError) {
      return { error: existingReviewError.message };
    }

    if (existingReview) {
      return { error: "You have already submitted this review" };
    }

    const { error: insertError } = await supabase.from("reviews").insert({
      booking_id: booking.id,
      listing_id: booking.listing_id,
      reviewer_id: user.id,
      reviewee_id: revieweeId,
      review_role: reviewRole,
      overall_rating: parsed.data.overall_rating,
      communication_rating: parsed.data.communication_rating ?? null,
      accuracy_rating: parsed.data.accuracy_rating ?? null,
      condition_rating: parsed.data.condition_rating ?? null,
      value_rating: parsed.data.value_rating ?? null,
      comment: parsed.data.comment ?? null,
    });

    if (insertError) {
      return { error: insertError.message };
    }

    const { error: bookingUpdateError } = await supabase
      .from("bookings")
      .update({ [reviewFlagField]: true })
      .eq("id", booking.id);

    if (bookingUpdateError) {
      return { error: bookingUpdateError.message };
    }

    await createReviewNotification({
      userId: revieweeId,
      bookingId: booking.id,
      listingId: booking.listing_id,
    });

    return { success: "Review submitted!" };
  } catch (error) {
    return { error: getErrorMessage(error, "Failed to submit review") };
  }
}

export async function getReviewsForUser(
  userId: string,
  role?: ReviewRole,
  page?: number,
): Promise<PaginatedResponse<ReviewWithUsers>> {
  const supabase = await createClient();
  const { currentPage, from, to } = getPagination(page);

  let query = supabase
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
    .eq("reviewee_id", userId)
    .order("created_at", { ascending: false });

  if (role) {
    query = query.eq("review_role", role);
  }

  const { data, error, count } = await query.range(from, to);

  if (error) {
    throw new Error(error.message);
  }

  return {
    data: (data ?? []) as ReviewWithUsers[],
    totalCount: count ?? 0,
    totalPages: Math.max(1, Math.ceil((count ?? 0) / REVIEWS_PER_PAGE)),
    currentPage,
  };
}

export async function getReviewsForListing(
  listingId: string,
  page?: number,
): Promise<PaginatedResponse<ReviewWithUsers>> {
  const supabase = await createClient();
  const { currentPage, from, to } = getPagination(page);

  const { data, error, count } = await supabase
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
    .eq("listing_id", listingId)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) {
    throw new Error(error.message);
  }

  return {
    data: (data ?? []) as ReviewWithUsers[],
    totalCount: count ?? 0,
    totalPages: Math.max(1, Math.ceil((count ?? 0) / REVIEWS_PER_PAGE)),
    currentPage,
  };
}

export async function getMyWrittenReviews(userId: string): Promise<ReviewWithUsers[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("reviews")
    .select(
      `
        *,
        reviewer:profiles!reviews_reviewer_id_fkey(*),
        reviewee:profiles!reviews_reviewee_id_fkey(*),
        listing:listings(*)
      `,
    )
    .eq("reviewer_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as ReviewWithUsers[];
}

export async function respondToReview(
  reviewId: string,
  response: string,
): Promise<ActionResponse> {
  try {
    const { supabase, user } = await getCurrentUserContext();
    const trimmedResponse = response.trim();

    if (trimmedResponse.length < 3) {
      return { error: "Response must be at least 3 characters" };
    }

    const { data: review, error: reviewError } = await supabase
      .from("reviews")
      .select("reviewee_id")
      .eq("id", reviewId)
      .maybeSingle<{ reviewee_id: string }>();

    if (reviewError || !review) {
      return { error: "Review not found" };
    }

    if (review.reviewee_id !== user.id) {
      return { error: "You cannot respond to this review" };
    }

    const { error: updateError } = await supabase
      .from("reviews")
      .update({
        response: trimmedResponse,
        responded_at: new Date().toISOString(),
      })
      .eq("id", reviewId);

    if (updateError) {
      return { error: updateError.message };
    }

    return { success: "Response added" };
  } catch (error) {
    return { error: getErrorMessage(error, "Failed to add response") };
  }
}

export async function getPendingReviews(
  userId: string,
): Promise<BookingWithDetails[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("bookings")
    .select(
      `
        *,
        listing:listings!bookings_listing_id_fkey(*),
        renter:profiles!bookings_renter_id_fkey(*),
        lister:profiles!bookings_lister_id_fkey(*)
      `,
    )
    .eq("status", "completed")
    .or(
      `and(renter_id.eq.${userId},renter_reviewed.eq.false),and(lister_id.eq.${userId},lister_reviewed.eq.false)`,
    )
    .order("updated_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as BookingWithDetails[];
}
