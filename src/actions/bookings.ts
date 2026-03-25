"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { format } from "date-fns";

import { createPaymentForBooking } from "@/actions/hitpay";
import { createNotification } from "@/actions/notifications";
import { calculateNumUnits } from "@/lib/bookings";
import { createClient } from "@/lib/supabase/server";
import { bookingRequestSchema } from "@/lib/validations";
import type {
  ActionResponse,
  Booking,
  BookingStatus,
  BookingWithDetails,
  Listing,
  PricingCalculation,
  Profile,
} from "@/types";

const RENTER_SERVICE_FEE_RATE = 0.05;
const LISTER_SERVICE_FEE_RATE = 0.05;
const CANCELLED_STATUSES = new Set<BookingStatus>([
  "cancelled_by_lister",
  "cancelled_by_renter",
]);

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;
type AuthContext = {
  supabase: SupabaseClient;
  user: NonNullable<
    Awaited<ReturnType<SupabaseClient["auth"]["getUser"]>>["data"]["user"]
  >;
};

type BookingQueryRecord = Booking & {
  listing: Listing;
  renter: Profile;
  lister: Profile;
};

type BookingActionResponse = ActionResponse & {
  bookingId?: string;
  paymentUrl?: string | null;
};

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function normalizeText(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function toDateOnlyString(value: string | Date) {
  return format(new Date(value), "yyyy-MM-dd");
}

function getUnitPrice(listing: Listing, pricingPeriod: Booking["pricing_period"]) {
  switch (pricingPeriod) {
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

function calculatePricing(
  listing: Listing,
  pricingPeriod: Booking["pricing_period"],
  quantity: number,
  startDate: string | Date,
  endDate: string | Date,
): PricingCalculation {
  const unitPrice = getUnitPrice(listing, pricingPeriod);

  if (typeof unitPrice !== "number") {
    throw new Error(`This listing does not support ${pricingPeriod} pricing`);
  }

  const numUnits = calculateNumUnits(startDate, endDate, pricingPeriod);
  const subtotal = roundMoney(unitPrice * numUnits * quantity);
  const serviceFeeRenter = roundMoney(subtotal * RENTER_SERVICE_FEE_RATE);
  const serviceFeeLister = roundMoney(subtotal * LISTER_SERVICE_FEE_RATE);
  const deliveryFee = listing.delivery_available
    ? roundMoney(listing.delivery_fee ?? 0)
    : 0;
  const depositAmount = roundMoney((listing.deposit_amount ?? 0) * quantity);
  const totalPrice = roundMoney(
    subtotal + serviceFeeRenter + deliveryFee + depositAmount,
  );
  const listerPayout = roundMoney(subtotal - serviceFeeLister);

  return {
    subtotal,
    serviceFeeRenter,
    serviceFeeLister,
    depositAmount,
    deliveryFee,
    totalPrice,
    listerPayout,
    numUnits,
    unitPrice,
  };
}

async function requireAuthenticatedUser(): Promise<AuthContext> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return { supabase, user };
}

async function callRpcWithFallbacks<T>(
  supabase: SupabaseClient,
  fn: string,
  argsList: Record<string, unknown>[],
) {
  let lastError: Error | null = null;

  for (const args of argsList) {
    const { data, error } = await supabase.rpc(fn, args);

    if (!error) {
      return data as T;
    }

    lastError = new Error(error.message);
  }

  throw lastError ?? new Error(`RPC ${fn} failed`);
}

function extractRpcNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  if (Array.isArray(value) && value.length > 0) {
    const first = value[0];

    if (typeof first === "number") {
      return first;
    }

    if (first && typeof first === "object") {
      for (const key of [
        "get_available_stock",
        "available_stock",
        "stock_available",
      ]) {
        const candidate = (first as Record<string, unknown>)[key];
        const parsed = extractRpcNumber(candidate);
        if (parsed !== null) {
          return parsed;
        }
      }
    }
  }

  if (value && typeof value === "object") {
    for (const key of ["get_available_stock", "available_stock", "stock_available"]) {
      const candidate = (value as Record<string, unknown>)[key];
      const parsed = extractRpcNumber(candidate);
      if (parsed !== null) {
        return parsed;
      }
    }
  }

  return null;
}

async function getAvailableStock(
  supabase: SupabaseClient,
  listing: Listing,
  startDate: string,
  endDate: string,
) {
  if (!listing.track_inventory) {
    return Number.MAX_SAFE_INTEGER;
  }

  const data = await callRpcWithFallbacks<unknown>(supabase, "get_available_stock", [
    {
      p_listing_id: listing.id,
      p_start_date: startDate,
      p_end_date: endDate,
    },
    {
      listing_id: listing.id,
      start_date: startDate,
      end_date: endDate,
    },
  ]);

  const available = extractRpcNumber(data);

  if (available === null) {
    throw new Error("Could not determine available stock");
  }

  return available;
}

async function reserveStock(
  supabase: SupabaseClient,
  booking: Pick<BookingQueryRecord, "id" | "listing_id" | "quantity">,
  userId: string,
) {
  const result = await callRpcWithFallbacks<boolean | null>(supabase, "reserve_stock", [
    {
      p_listing_id: booking.listing_id,
      p_booking_id: booking.id,
      p_quantity: booking.quantity,
      p_user_id: userId,
    },
    {
      listing_id: booking.listing_id,
      booking_id: booking.id,
      quantity: booking.quantity,
      user_id: userId,
    },
  ]);

  if (result === false) {
    throw new Error("Not enough stock available to reserve this booking");
  }
}

async function releaseStock(
  supabase: SupabaseClient,
  booking: Pick<BookingQueryRecord, "id" | "listing_id" | "quantity">,
  userId: string,
) {
  await callRpcWithFallbacks(supabase, "release_stock", [
    {
      p_listing_id: booking.listing_id,
      p_booking_id: booking.id,
      p_quantity: booking.quantity,
      p_user_id: userId,
    },
    {
      listing_id: booking.listing_id,
      booking_id: booking.id,
      quantity: booking.quantity,
      user_id: userId,
    },
  ]);
}

async function returnStock(
  supabase: SupabaseClient,
  booking: Pick<BookingQueryRecord, "id" | "listing_id" | "quantity">,
  userId: string,
) {
  await callRpcWithFallbacks(supabase, "return_stock", [
    {
      p_listing_id: booking.listing_id,
      p_booking_id: booking.id,
      p_quantity: booking.quantity,
      p_user_id: userId,
    },
    {
      listing_id: booking.listing_id,
      booking_id: booking.id,
      quantity: booking.quantity,
      user_id: userId,
    },
  ]);
}

async function getBookingForUpdate(
  supabase: SupabaseClient,
  bookingId: string,
) {
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
    .eq("id", bookingId)
    .maybeSingle();

  if (error || !data) {
    throw new Error("Booking not found");
  }

  return data as BookingQueryRecord;
}

function revalidateBookingViews() {
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/requests");
  revalidatePath("/dashboard/my-rentals");
}

function getBookingRequestFormData(
  prevStateOrFormData: ActionResponse | FormData | null,
  maybeFormData?: FormData,
) {
  return prevStateOrFormData instanceof FormData
    ? prevStateOrFormData
    : maybeFormData;
}

export async function createBookingRequest(
  prevStateOrFormData: ActionResponse | FormData | null,
  maybeFormData?: FormData,
): Promise<BookingActionResponse> {
  try {
    const { supabase, user } = await requireAuthenticatedUser();
    const formData = getBookingRequestFormData(prevStateOrFormData, maybeFormData);

    if (!formData) {
      return { error: "Missing booking form data" };
    }

    const parsed = bookingRequestSchema.safeParse({
      listing_id: formData.get("listing_id"),
      start_date: formData.get("start_date"),
      end_date: formData.get("end_date"),
      quantity: formData.get("quantity"),
      pricing_period: formData.get("pricing_period"),
      message: normalizeText(formData.get("message")?.toString()),
    });

    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Invalid booking request" };
    }

    const startDate = toDateOnlyString(parsed.data.start_date);
    const endDate = toDateOnlyString(parsed.data.end_date);
    const today = toDateOnlyString(new Date());

    if (startDate < today) {
      return { error: "Start date cannot be in the past" };
    }

    if (endDate <= startDate) {
      return { error: "End date must be after start date" };
    }

    const { data: listing, error: listingError } = await supabase
      .from("listings")
      .select("*")
      .eq("id", parsed.data.listing_id)
      .eq("status", "active")
      .maybeSingle<Listing>();

    if (listingError || !listing) {
      return { error: "Listing not found" };
    }

    if (listing.owner_id === user.id) {
      return { error: "You cannot book your own listing" };
    }

    const availableStock = await getAvailableStock(
      supabase,
      listing,
      startDate,
      endDate,
    );

    if (availableStock < parsed.data.quantity) {
      return { error: "Not enough stock available" };
    }

    const pricing: PricingCalculation = calculatePricing(
      listing,
      parsed.data.pricing_period,
      parsed.data.quantity,
      startDate,
      endDate,
    );

    const { data: insertedBooking, error: insertError } = await supabase
      .from("bookings")
      .insert({
        listing_id: listing.id,
        renter_id: user.id,
        lister_id: listing.owner_id,
        start_date: startDate,
        end_date: endDate,
        quantity: parsed.data.quantity,
        pricing_period: parsed.data.pricing_period,
        unit_price: pricing.unitPrice,
        num_units: pricing.numUnits,
        subtotal: pricing.subtotal,
        delivery_fee: pricing.deliveryFee,
        service_fee_renter: pricing.serviceFeeRenter,
        service_fee_lister: pricing.serviceFeeLister,
        deposit_amount: pricing.depositAmount,
        total_price: pricing.totalPrice,
        lister_payout: pricing.listerPayout,
        status: "pending",
        message: parsed.data.message ?? null,
        stock_deducted: false,
        stock_restored: false,
      })
      .select("*")
      .single<Booking>();

    if (insertError) {
      return { error: insertError.message };
    }

    await createNotification({
      userId: listing.owner_id,
      type: "booking_request",
      title: `New booking request for ${listing.title}`,
      body: `${user.user_metadata.display_name || user.email || "A renter"} requested ${parsed.data.quantity} item(s) for ${listing.title}.`,
      listingId: listing.id,
      bookingId: insertedBooking.id,
      fromUserId: user.id,
      actionUrl: "/dashboard/requests",
    });

    let paymentUrl: string | null = null;

    if (listing.instant_book) {
      await reserveStock(
        supabase,
        {
          id: insertedBooking.id,
          listing_id: insertedBooking.listing_id,
          quantity: insertedBooking.quantity,
        },
        user.id,
      );

      const { error: confirmError } = await supabase
        .from("bookings")
        .update({
          status: "confirmed",
          stock_deducted: true,
        })
        .eq("id", insertedBooking.id);

      if (confirmError) {
        return { error: confirmError.message };
      }

      const paymentResult = await createPaymentForBooking(insertedBooking.id);
      if ("error" in paymentResult) {
        return paymentResult;
      }
      paymentUrl = paymentResult.paymentUrl;

      await createNotification({
        userId: user.id,
        type: "booking_confirmed",
        title: "Booking confirmed — please complete payment",
        body: paymentUrl
          ? `Your instant booking for ${listing.title} is confirmed. Complete payment to secure it.`
          : `Your instant booking for ${listing.title} is confirmed.`,
        listingId: listing.id,
        bookingId: insertedBooking.id,
        fromUserId: listing.owner_id,
        actionUrl: paymentUrl ?? "/dashboard/my-rentals",
      });
    }

    revalidateBookingViews();

    return {
      success: "Booking request sent!",
      bookingId: insertedBooking.id,
      paymentUrl,
    };
  } catch (error) {
    console.error("createBookingRequest failed:", error);
    return { error: "Something went wrong. Please try again." };
  }
}

export async function acceptBookingRequest(
  bookingId: string,
): Promise<BookingActionResponse> {
  try {
    const { supabase, user } = await requireAuthenticatedUser();
    const booking = await getBookingForUpdate(supabase, bookingId);

    if (booking.lister_id !== user.id) {
      return { error: "You are not allowed to accept this booking" };
    }

    if (booking.status !== "pending") {
      return { error: "Only pending bookings can be accepted" };
    }

    const availableStock = await getAvailableStock(
      supabase,
      booking.listing,
      booking.start_date,
      booking.end_date,
    );

    if (availableStock < booking.quantity) {
      return { error: "Insufficient stock" };
    }

    await reserveStock(supabase, booking, user.id);

    const { error: updateError } = await supabase
      .from("bookings")
      .update({
        status: "confirmed",
        stock_deducted: true,
      })
      .eq("id", booking.id);

    if (updateError) {
      return { error: updateError.message };
    }

    const paymentResult = await createPaymentForBooking(booking.id);
    if ("error" in paymentResult) {
      return paymentResult;
    }
    const paymentUrl = paymentResult.paymentUrl;

    await createNotification({
      userId: booking.renter_id,
      type: "booking_confirmed",
      title: "Booking accepted",
      body: paymentUrl
        ? `${booking.listing.title} was accepted. Use the payment link to complete checkout.`
        : `${booking.listing.title} was accepted and is ready for payment.`,
      listingId: booking.listing_id,
      bookingId: booking.id,
      fromUserId: user.id,
      actionUrl: paymentUrl ?? "/dashboard/my-rentals",
    });

    revalidateBookingViews();

    return {
      success: "Booking accepted",
      paymentUrl,
    };
  } catch (error) {
    console.error("acceptBookingRequest failed:", error);
    return { error: "Something went wrong. Please try again." };
  }
}

export async function declineBookingRequest(
  bookingId: string,
  reason?: string,
): Promise<ActionResponse> {
  try {
    const { supabase, user } = await requireAuthenticatedUser();
    const booking = await getBookingForUpdate(supabase, bookingId);

    if (booking.lister_id !== user.id) {
      return { error: "You are not allowed to decline this booking" };
    }

    if (booking.status !== "pending") {
      return { error: "Only pending bookings can be declined" };
    }

    const declineReason =
      normalizeText(reason) ?? "Booking request declined by lister";
    const { error } = await supabase
      .from("bookings")
      .update({
        status: "cancelled_by_lister",
        cancelled_at: new Date().toISOString(),
        cancelled_by: user.id,
        cancellation_reason: declineReason,
      })
      .eq("id", booking.id);

    if (error) {
      return { error: error.message };
    }

    await createNotification({
      userId: booking.renter_id,
      type: "booking_declined",
      title: "Booking declined",
      body: declineReason,
      listingId: booking.listing_id,
      bookingId: booking.id,
      fromUserId: user.id,
      actionUrl: "/dashboard/my-rentals",
    });

    revalidateBookingViews();

    return { success: "Booking declined" };
  } catch (error) {
    console.error("declineBookingRequest failed:", error);
    return { error: "Something went wrong. Please try again." };
  }
}

export async function cancelBooking(
  bookingId: string,
  reason?: string,
): Promise<ActionResponse> {
  try {
    const { supabase, user } = await requireAuthenticatedUser();
    const booking = await getBookingForUpdate(supabase, bookingId);
    const isRenter = booking.renter_id === user.id;
    const isLister = booking.lister_id === user.id;

    if (!isRenter && !isLister) {
      return { error: "You are not allowed to cancel this booking" };
    }

    if (CANCELLED_STATUSES.has(booking.status) || booking.status === "completed") {
      return { error: "This booking can no longer be cancelled" };
    }

    if (booking.stock_deducted && !booking.stock_restored) {
      await releaseStock(supabase, booking, user.id);
    }

    const status: BookingStatus = isRenter
      ? "cancelled_by_renter"
      : "cancelled_by_lister";
    const normalizedReason = normalizeText(reason) ?? "Booking cancelled";
    const refundNote = booking.paid_at
      ? `${normalizedReason} Refund processing required.`
      : normalizedReason;

    const { error } = await supabase
      .from("bookings")
      .update({
        status,
        cancelled_at: new Date().toISOString(),
        cancelled_by: user.id,
        cancellation_reason: refundNote,
        stock_restored: booking.stock_deducted ? true : booking.stock_restored,
      })
      .eq("id", booking.id);

    if (error) {
      return { error: error.message };
    }

    await createNotification({
      userId: isRenter ? booking.lister_id : booking.renter_id,
      type: "booking_cancelled",
      title: "Booking cancelled",
      body: refundNote,
      listingId: booking.listing_id,
      bookingId: booking.id,
      fromUserId: user.id,
      actionUrl: isRenter ? "/dashboard/requests" : "/dashboard/my-rentals",
    });

    revalidateBookingViews();

    return {
      success: booking.paid_at
        ? "Booking cancelled and flagged for refund processing"
        : "Booking cancelled",
    };
  } catch (error) {
    console.error("cancelBooking failed:", error);
    return { error: "Something went wrong. Please try again." };
  }
}

export async function completeBooking(
  bookingId: string,
): Promise<ActionResponse> {
  try {
    const { supabase, user } = await requireAuthenticatedUser();
    const booking = await getBookingForUpdate(supabase, bookingId);

    if (booking.lister_id !== user.id) {
      return { error: "You are not allowed to complete this booking" };
    }

    if (booking.status !== "active" && booking.status !== "confirmed") {
      return { error: "Only active or confirmed bookings can be completed" };
    }

    await returnStock(supabase, booking, user.id);

    const { error: bookingUpdateError } = await supabase
      .from("bookings")
      .update({
        status: "completed",
        stock_restored: true,
        payout_at: new Date().toISOString(),
      })
      .eq("id", booking.id);

    if (bookingUpdateError) {
      return { error: bookingUpdateError.message };
    }

    const { error: payoutError } = await supabase.from("payouts").insert({
      lister_id: booking.lister_id,
      booking_id: booking.id,
      amount: booking.lister_payout,
      currency: "USD",
      status: "pending",
      payout_method: booking.lister.payout_email ? "hitpay" : "manual",
      notes: "Created automatically when booking was completed",
    });

    if (payoutError) {
      return { error: payoutError.message };
    }

    await Promise.all([
      createNotification({
        userId: booking.renter_id,
        type: "booking_completed",
        title: "Rental completed",
        body: `Your rental for ${booking.listing.title} is complete. Leave a review for the lister.`,
        listingId: booking.listing_id,
        bookingId: booking.id,
        fromUserId: user.id,
        actionUrl: "/dashboard/reviews",
      }),
      createNotification({
        userId: booking.lister_id,
        type: "booking_completed",
        title: "Rental completed",
        body: `The booking for ${booking.listing.title} is complete. Leave a review for the renter.`,
        listingId: booking.listing_id,
        bookingId: booking.id,
        fromUserId: user.id,
        actionUrl: "/dashboard/reviews",
      }),
    ]);

    revalidateBookingViews();

    return { success: "Booking completed" };
  } catch (error) {
    console.error("completeBooking failed:", error);
    return { error: "Something went wrong. Please try again." };
  }
}

export async function getIncomingRequests(
  listerId: string,
): Promise<BookingWithDetails[]> {
  try {
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
      .eq("lister_id", listerId)
      .order("created_at", { ascending: false });

    if (error) {
      throw error;
    }

    return (data ?? []) as BookingWithDetails[];
  } catch (error) {
    console.error("getIncomingRequests failed:", error);
    return [];
  }
}

export async function getMyRentals(
  renterId: string,
): Promise<BookingWithDetails[]> {
  try {
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
      .eq("renter_id", renterId)
      .order("created_at", { ascending: false });

    if (error) {
      throw error;
    }

    return (data ?? []) as BookingWithDetails[];
  } catch (error) {
    console.error("getMyRentals failed:", error);
    return [];
  }
}

export async function getBookingDetails(
  bookingId: string,
): Promise<BookingWithDetails | null> {
  try {
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
      .eq("id", bookingId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return (data as BookingWithDetails | null) ?? null;
  } catch (error) {
    console.error("getBookingDetails failed:", error);
    return null;
  }
}
