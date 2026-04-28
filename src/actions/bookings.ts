"use server";

import { revalidatePath } from "next/cache";
import {
  addDays,
  addHours,
  addMonths,
  addWeeks,
  differenceInHours,
  format,
  startOfDay,
} from "date-fns";

import { createNotification } from "@/actions/notifications";
import {
  autoTriggerPayout,
  createPaymentForBooking,
  handlePaymentConfirmed,
  holdPaymentForDispute,
  processCancellationRefund,
} from "@/actions/payments";
import {
  getAdminIds,
  notifyBookingCompleted,
  notifyItemReturned,
  notifyRentalStarted,
  sendNotification,
} from "@/lib/notifications";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  bookingSchema,
  confirmReturnSchema,
  listerCancelSchema,
} from "@/lib/validations";
import type {
  ActionResponse,
  Booking,
  BookingStatus,
  BookingTimeline,
  BookingTimelineWithActor,
  BookingWithDetails,
  Listing,
  PricingPeriod,
  Profile,
  TimelineActorRole,
} from "@/types";

const RENTER_SERVICE_FEE_RATE = 0.05;
const LISTER_SERVICE_FEE_RATE = 0.05;
const PAYMENT_EXPIRY_HOURS = 24;
const PROOFS_BUCKET = "booking-proofs";
const MAX_PROOF_PHOTOS = 5;
const MAX_PROOF_FILE_BYTES = 10 * 1024 * 1024;

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;
type AdminSupabaseClient = ReturnType<typeof createAdminClient>;
type AnySupabaseClient = SupabaseClient | AdminSupabaseClient;
type MaybeArray<T> = T | T[] | null;
type BookingRecord = Booking & {
  listing: MaybeArray<Listing>;
  renter: MaybeArray<Profile>;
  lister: MaybeArray<Profile>;
};
type ListingRecord = Listing & {
  owner: MaybeArray<Profile>;
};
type AuthContext = {
  supabase: SupabaseClient;
  user: NonNullable<
    Awaited<ReturnType<SupabaseClient["auth"]["getUser"]>>["data"]["user"]
  >;
  profile: Profile | null;
};

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function normalizeText(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function sanitizeFilename(filename: string) {
  return filename.replace(/[^a-zA-Z0-9._-]/g, "-");
}

function formatDateTime(value: string | Date | null | undefined) {
  if (!value) {
    return "TBD";
  }

  return format(new Date(value), "PPP p");
}

function formatMoney(value: number) {
  return `$${value.toFixed(2)}`;
}

function toIsoDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

function computeBookingDates(params: {
  pricingPeriod: PricingPeriod;
  rentalUnits: number;
  now?: Date;
}) {
  const startDate = startOfDay(params.now ?? new Date());
  const safeUnits = Math.max(1, params.rentalUnits);

  let endDate: Date;
  switch (params.pricingPeriod) {
    case "hour":
      // The schema stores date-only booking windows, so we reserve at least one day
      // for hourly rentals and extend by whole-day equivalents after that.
      endDate = addDays(startDate, Math.max(1, Math.ceil(safeUnits / 24)));
      break;
    case "day":
      endDate = addDays(startDate, safeUnits);
      break;
    case "week":
      endDate = addWeeks(startDate, safeUnits);
      break;
    case "month":
      endDate = addMonths(startDate, safeUnits);
      break;
    default:
      endDate = addDays(startDate, 1);
      break;
  }

  return {
    startDate,
    endDate,
    startDateIso: toIsoDate(startDate),
    endDateIso: toIsoDate(endDate),
  };
}

function unwrapRelation<T>(value: MaybeArray<T>): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

function getActorDisplayName(profile: Profile | null, fallback?: string | null) {
  return profile?.display_name || profile?.full_name || fallback || "Someone";
}

function getRoleForBooking(
  booking: Pick<Booking, "renter_id" | "lister_id">,
  userId: string,
): "renter" | "lister" | null {
  if (booking.renter_id === userId) return "renter";
  if (booking.lister_id === userId) return "lister";
  return null;
}

function revalidateBookingViews() {
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/requests");
  revalidatePath("/dashboard/my-rentals");
  revalidatePath("/dashboard/bookings");
  revalidatePath("/lister/bookings");
  revalidatePath("/renter/rentals");
  revalidatePath("/payment/success");
}

function getFormData(
  prevStateOrFormData: ActionResponse | FormData | null,
  maybeFormData?: FormData,
) {
  return prevStateOrFormData instanceof FormData
    ? prevStateOrFormData
    : maybeFormData;
}

function extractRpcDateTime(value: unknown): string | null {
  if (typeof value === "string" && value.trim().length > 0) return value;

  if (Array.isArray(value) && value.length > 0) {
    for (const row of value) {
      const parsed = extractRpcDateTime(row);
      if (parsed) return parsed;
    }
  }

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    for (const key of ["rental_ends_at", "end_date", "rental_end", "rental_end_at"]) {
      const parsed = extractRpcDateTime(record[key]);
      if (parsed) return parsed;
    }
  }

  return null;
}

async function requireAuthenticatedUser(): Promise<AuthContext | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle<Profile>();

  return { supabase, user, profile: profile ?? null };
}

async function callRpcWithFallbacks<T>(
  supabase: AnySupabaseClient,
  fn: string,
  argsList: Record<string, unknown>[],
) {
  let lastError: Error | null = null;

  for (const args of argsList) {
    const { data, error } = await supabase.rpc(fn, args);
    if (!error) return data as T;
    lastError = new Error(error.message);
  }

  throw lastError ?? new Error(`RPC ${fn} failed`);
}

function isMissingRpcSignatureError(error: unknown, fn: string) {
  if (!(error instanceof Error)) {
    return false;
  }

  return error.message.includes(`Could not find the function public.${fn}`);
}

async function startRentalPeriodDirect(params: {
  supabase: SupabaseClient;
  booking: BookingRecord;
  userId: string;
  notes?: string;
  photoUrls: string[];
}) {
  const startedAt = new Date().toISOString();
  const fallbackRentalEndsAt = params.booking.rental_ends_at ?? params.booking.end_date ?? null;

  const { error } = await params.supabase
    .from("bookings")
    .update({
      status: "active",
      rental_started_at: startedAt,
      rental_ends_at: fallbackRentalEndsAt,
      handover_at: startedAt,
      handover_notes: params.notes ?? null,
      handover_proof_urls: params.photoUrls,
    })
    .eq("id", params.booking.id)
    .eq("lister_id", params.userId)
    .eq("status", "confirmed");

  if (error) {
    throw new Error(error.message);
  }

  await addTimeline({
    bookingId: params.booking.id,
    status: "active",
    previousStatus: "confirmed",
    actorId: params.userId,
    actorRole: "lister",
    title: "Item handed over",
    description: "Lister confirmed handover and started the rental period.",
    metadata: {
      handover_notes: params.notes ?? null,
      proof_photos: params.photoUrls,
      rental_ends_at: fallbackRentalEndsAt,
    },
  });

  return fallbackRentalEndsAt;
}

async function markReturnToListerDirect(params: {
  supabase: SupabaseClient;
  booking: BookingRecord;
  userId: string;
  notes?: string;
  photoUrls: string[];
}) {
  const returnedAt = new Date().toISOString();
  const isLateReturn = Boolean(
    params.booking.rental_ends_at &&
      new Date(returnedAt).getTime() > new Date(params.booking.rental_ends_at).getTime(),
  );

  const { error } = await params.supabase
    .from("bookings")
    .update({
      status: "returned",
      returned_at: returnedAt,
      return_notes: params.notes ?? null,
      return_proof_urls: params.photoUrls,
    })
    .eq("id", params.booking.id)
    .eq("renter_id", params.userId)
    .eq("status", "active");

  if (error) {
    throw new Error(error.message);
  }

  await addTimeline({
    bookingId: params.booking.id,
    status: "returned",
    previousStatus: "active",
    actorId: params.userId,
    actorRole: "renter",
    title: "Item returned",
    description: isLateReturn
      ? "Renter confirmed the item was returned after the rental deadline."
      : "Renter confirmed the item was returned to the lister.",
    metadata: {
      return_notes: params.notes ?? null,
      proof_photos: params.photoUrls,
      returned_at: returnedAt,
      rental_ends_at: params.booking.rental_ends_at ?? null,
      is_late_return: isLateReturn,
    },
  });

  return isLateReturn;
}

async function addTimeline(params: {
  bookingId: string;
  status: BookingStatus;
  previousStatus?: BookingStatus;
  actorId?: string | null;
  actorRole: TimelineActorRole;
  title: string;
  description?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const payload = {
    booking_id: params.bookingId,
    status: params.status,
    previous_status: params.previousStatus ?? null,
    actor_id: params.actorId ?? null,
    actor_role: params.actorRole,
    title: params.title,
    description: params.description ?? null,
    metadata: params.metadata ?? {},
  };

  try {
    const admin = createAdminClient();
    await callRpcWithFallbacks(admin, "add_booking_timeline", [
      {
        p_booking_id: payload.booking_id,
        p_status: payload.status,
        p_previous_status: payload.previous_status,
        p_actor_id: payload.actor_id,
        p_actor_role: payload.actor_role,
        p_title: payload.title,
        p_description: payload.description,
        p_metadata: payload.metadata,
      },
      {
        booking_id: payload.booking_id,
        status: payload.status,
        previous_status: payload.previous_status,
        actor_id: payload.actor_id,
        actor_role: payload.actor_role,
        title: payload.title,
        description: payload.description,
        metadata: payload.metadata,
      },
    ]);
  } catch (error) {
    try {
      const admin = createAdminClient();
      const { error: insertError } = await admin.from("booking_timeline").insert(payload);

      if (insertError) {
        throw new Error(insertError.message);
      }
    } catch (fallbackError) {
      console.error("addTimeline failed:", error);
      console.error("addTimeline fallback insert failed:", fallbackError);
    }
  }
}

async function uploadProofPhotos(
  bookingId: string,
  type: "handover" | "return",
  files: File[],
): Promise<string[]> {
  if (files.length < 1) {
    throw new Error("At least 1 proof photo is required.");
  }
  if (files.length > MAX_PROOF_PHOTOS) {
    throw new Error(`You can upload at most ${MAX_PROOF_PHOTOS} proof photos.`);
  }

  for (const file of files) {
    if (!file.type.startsWith("image/")) {
      throw new Error("Proof files must be images.");
    }
    if (file.size > MAX_PROOF_FILE_BYTES) {
      throw new Error("Each proof photo must be 10MB or smaller.");
    }
  }

  const supabase = await createClient();
  const urls: string[] = [];

  for (const file of files) {
    const path = `${bookingId}/${type}/${crypto.randomUUID()}-${sanitizeFilename(file.name || "proof.jpg")}`;
    const buffer = await file.arrayBuffer();

    const { error: uploadError } = await supabase.storage
      .from(PROOFS_BUCKET)
      .upload(path, buffer, { contentType: file.type, upsert: false });

    if (uploadError) {
      throw new Error(`Failed to upload proof photo: ${uploadError.message}`);
    }

    const { data } = supabase.storage.from(PROOFS_BUCKET).getPublicUrl(path);
    urls.push(data.publicUrl);
  }

  return urls;
}

async function getBookingRecord(
  supabase: AnySupabaseClient,
  bookingId: string,
) {
  async function fetchBooking() {
    return supabase
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
      .maybeSingle<BookingRecord>();
  }

  let { data, error } = await fetchBooking();

  if (error || !data) {
    throw new Error("Booking not found");
  }

  if (data.status === "completed" && !data.payout_id) {
    const payoutResult = await autoTriggerPayout(bookingId);
    if (!payoutResult.success) {
      console.error("getBookingRecord autoTriggerPayout failed:", payoutResult.error);
    } else {
      const refreshed = await fetchBooking();
      data = refreshed.data ?? data;
      error = refreshed.error ?? null;
    }
  }

  const listing = unwrapRelation(data.listing);
  const renter = unwrapRelation(data.renter);
  const lister = unwrapRelation(data.lister);

  if (!listing || !renter || !lister) {
    throw new Error("Booking relations are incomplete");
  }

  return { ...data, listing, renter, lister };
}

async function getListingRecord(
  supabase: AnySupabaseClient,
  listingId: string,
) {
  const { data, error } = await supabase
    .from("listings")
    .select("*, owner:profiles!listings_owner_id_fkey(*)")
    .eq("id", listingId)
    .maybeSingle<ListingRecord>();

  if (error || !data) {
    throw new Error("Listing not found");
  }

  const owner = unwrapRelation(data.owner);
  if (!owner) {
    throw new Error("Listing owner not found");
  }

  return { ...data, owner };
}

function getUnitPrice(listing: Listing, pricingPeriod: PricingPeriod) {
  switch (pricingPeriod) {
    case "hour":
      return listing.price_per_hour;
    case "day":
      return listing.price_per_day;
    case "week":
      return listing.price_per_week;
    case "month":
      return listing.price_per_month;
    default:
      return null;
  }
}

async function reserveStock(
  supabase: AnySupabaseClient,
  booking: Pick<Booking, "id" | "listing_id" | "quantity">,
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
    throw new Error("Not enough stock available to reserve this booking.");
  }
}

async function releaseStock(
  supabase: AnySupabaseClient,
  booking: Pick<Booking, "id" | "listing_id" | "quantity">,
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
  supabase: AnySupabaseClient,
  booking: Pick<Booking, "id" | "listing_id" | "quantity">,
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

async function checkBookingConflict(params: {
  supabase: AnySupabaseClient;
  listingId: string;
  renterId: string;
  quantity: number;
  rentalUnits: number;
  pricingPeriod: PricingPeriod;
}) {
  let result: unknown;

  try {
    result = await callRpcWithFallbacks<unknown>(
      params.supabase,
      "check_booking_conflict",
      [
        {
          p_listing_id: params.listingId,
          p_renter_id: params.renterId,
          p_quantity: params.quantity,
          p_rental_units: params.rentalUnits,
          p_pricing_period: params.pricingPeriod,
        },
        {
          listing_id: params.listingId,
          renter_id: params.renterId,
          quantity: params.quantity,
          rental_units: params.rentalUnits,
          pricing_period: params.pricingPeriod,
        },
      ],
    );
  } catch (error) {
    if (!isMissingRpcSignatureError(error, "check_booking_conflict")) {
      throw error;
    }

    // Older environments may not have the booking conflict RPC yet.
    // In that case we fall back to stock reservation as the authoritative guard.
    return {
      hasConflict: false,
      reason: null,
    };
  }

  if (typeof result === "boolean") {
    return {
      hasConflict: result,
      reason: result ? "This item is no longer available for those dates." : null,
    };
  }

  const record = Array.isArray(result)
    ? ((result[0] as Record<string, unknown> | undefined) ?? null)
    : result && typeof result === "object"
      ? (result as Record<string, unknown>)
      : null;

  return {
    hasConflict: Boolean(record?.has_conflict ?? record?.conflict),
    reason:
      typeof record?.reason === "string"
        ? record.reason
        : typeof record?.message === "string"
          ? record.message
          : null,
  };
}

async function updateBookingAsCancelled(params: {
  supabase: AnySupabaseClient;
  bookingId: string;
  status: "cancelled_by_renter" | "cancelled_by_lister";
  actorId?: string | null;
  reason: string;
  autoCancelledReason?: string | null;
  stockRestored?: boolean;
  listingPausedDueToCancellation?: boolean;
}) {
  const { error } = await params.supabase
    .from("bookings")
    .update({
      status: params.status,
      cancelled_at: new Date().toISOString(),
      cancelled_by: params.actorId ?? null,
      cancellation_reason: params.reason,
      auto_cancelled_reason: params.autoCancelledReason ?? null,
      listing_paused_due_to_cancellation:
        params.listingPausedDueToCancellation ?? false,
      stock_restored: params.stockRestored ?? true,
      stock_reserved: false,
    })
    .eq("id", params.bookingId);

  if (error) {
    throw new Error(error.message);
  }
}

async function confirmPaymentInternal(params: {
  supabase: AnySupabaseClient;
  bookingId: string;
  paymentId?: string;
}): Promise<ActionResponse> {
  const booking = await getBookingRecord(params.supabase, params.bookingId);

  if (
    booking.hitpay_payment_status === "completed" &&
    booking.paid_at &&
    booking.status === "lister_confirmation"
  ) {
    return { success: "Payment already confirmed." };
  }

  if (
    booking.status !== "lister_confirmation" &&
    booking.status !== "confirmed" &&
    booking.status !== "cancelled_by_lister" &&
    booking.status !== "cancelled_by_renter"
  ) {
    return { error: "This booking is not in a payable state." };
  }

  await handlePaymentConfirmed({
    hitpayPaymentId: params.paymentId ?? booking.hitpay_payment_id ?? "",
    hitpayPaymentRequestId: booking.hitpay_payment_request_id ?? "",
    bookingId: booking.id,
    amount: booking.net_collected ?? booking.total_price,
    currency: "SGD",
  });

  revalidateBookingViews();
  return { success: "Payment confirmed." };
}

export async function createAndPayBooking(
  prevState: ActionResponse | FormData | null,
  formDataArg?: FormData,
): Promise<{ paymentUrl?: string; bookingId?: string; error?: string }> {
  void prevState;

  try {
    const auth = await requireAuthenticatedUser();
    if (!auth) {
      return { error: "You must be signed in to book this item." };
    }

    const formData = getFormData(prevState, formDataArg);
    if (!formData) {
      return { error: "Missing booking form data." };
    }

    const parsed = bookingSchema.safeParse({
      listing_id: formData.get("listing_id"),
      rental_units: formData.get("rental_units"),
      quantity: formData.get("quantity"),
      pricing_period: formData.get("pricing_period"),
      message: normalizeText(formData.get("message")?.toString()),
    });

    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Invalid booking details." };
    }

    const listing = await getListingRecord(auth.supabase, parsed.data.listing_id);
    if (listing.owner_id === auth.user.id) {
      return { error: "You cannot book your own listing." };
    }
    if (listing.status !== "active") {
      return { error: "This listing is not available right now." };
    }

    const conflict = await checkBookingConflict({
      supabase: auth.supabase,
      listingId: listing.id,
      renterId: auth.user.id,
      quantity: parsed.data.quantity,
      rentalUnits: parsed.data.rental_units,
      pricingPeriod: parsed.data.pricing_period,
    });
    if (conflict.hasConflict) {
      return {
        error:
          conflict.reason ?? "This item is no longer available for those dates.",
      };
    }

    const unitPrice = getUnitPrice(listing, parsed.data.pricing_period);
    if (typeof unitPrice !== "number") {
      return {
        error: `This item is not available for ${parsed.data.pricing_period} rental`,
      };
    }

    const subtotal = roundMoney(
      unitPrice * parsed.data.rental_units * parsed.data.quantity,
    );
    const serviceFeeRenter = roundMoney(subtotal * RENTER_SERVICE_FEE_RATE);
    const serviceFeeLister = roundMoney(subtotal * LISTER_SERVICE_FEE_RATE);
    const depositAmount = roundMoney(
      (listing.deposit_amount ?? 0) * parsed.data.quantity,
    );
    const totalPrice = roundMoney(subtotal + serviceFeeRenter + depositAmount);
    const listerPayout = roundMoney(subtotal - serviceFeeLister);
    const deadline = addHours(new Date(), PAYMENT_EXPIRY_HOURS).toISOString();
    const bookingDates = computeBookingDates({
      pricingPeriod: parsed.data.pricing_period,
      rentalUnits: parsed.data.rental_units,
    });

    const { data: createdBooking, error: insertError } = await auth.supabase
      .from("bookings")
      .insert({
        listing_id: listing.id,
        renter_id: auth.user.id,
        lister_id: listing.owner_id,
        start_date: bookingDates.startDateIso,
        end_date: bookingDates.endDateIso,
        rental_units: parsed.data.rental_units,
        pricing_period: parsed.data.pricing_period,
        unit_price: unitPrice,
        num_units: parsed.data.rental_units,
        quantity: parsed.data.quantity,
        subtotal,
        service_fee_renter: serviceFeeRenter,
        service_fee_lister: serviceFeeLister,
        deposit_amount: depositAmount,
        delivery_fee: 0,
        total_price: totalPrice,
        lister_payout: listerPayout,
        status: "lister_confirmation",
        lister_confirmation_deadline: deadline,
        stock_deducted: true,
        stock_reserved: true,
        stock_reserved_at: new Date().toISOString(),
        stock_restored: false,
        handover_proof_urls: [],
        return_proof_urls: [],
        message: parsed.data.message ?? null,
      })
      .select("id")
      .maybeSingle<{ id: string }>();

    if (insertError || !createdBooking) {
      return { error: insertError?.message ?? "Could not create booking." };
    }

    try {
      await reserveStock(
        auth.supabase,
        {
          id: createdBooking.id,
          listing_id: listing.id,
          quantity: parsed.data.quantity,
        },
        auth.user.id,
      );
    } catch (error) {
      await updateBookingAsCancelled({
        supabase: auth.supabase,
        bookingId: createdBooking.id,
        status: "cancelled_by_renter",
        actorId: auth.user.id,
        reason: "Could not reserve stock for this booking.",
        stockRestored: true,
      });

      return {
        error:
          error instanceof Error
            ? error.message
            : "Could not reserve stock for this booking.",
      };
    }

    await addTimeline({
      bookingId: createdBooking.id,
      status: "lister_confirmation",
      actorId: auth.user.id,
      actorRole: "renter",
      title: "Booking created - payment required",
      description: `You booked ${listing.title} for ${parsed.data.rental_units} ${parsed.data.pricing_period}(s). Complete payment to confirm. Lister has 24 hours to confirm availability.`,
      metadata: {
        rental_units: parsed.data.rental_units,
        pricing_period: parsed.data.pricing_period,
        quantity: parsed.data.quantity,
        subtotal,
        total_price: totalPrice,
        start_date: bookingDates.startDateIso,
        end_date: bookingDates.endDateIso,
        lister_confirmation_deadline: deadline,
      },
    });

    const paymentResult = await createPaymentForBooking(createdBooking.id);
    if ("error" in paymentResult) {
      await releaseStock(
        auth.supabase,
        {
          id: createdBooking.id,
          listing_id: listing.id,
          quantity: parsed.data.quantity,
        },
        auth.user.id,
      ).catch((releaseError) => {
        console.error("createAndPayBooking releaseStock failed:", releaseError);
      });

      await updateBookingAsCancelled({
        supabase: auth.supabase,
        bookingId: createdBooking.id,
        status: "cancelled_by_renter",
        actorId: auth.user.id,
        reason: paymentResult.error,
        stockRestored: true,
      });

      return { error: paymentResult.error };
    }

    const renterName = getActorDisplayName(auth.profile, auth.user.email);
    void sendNotification({
      userId: listing.owner_id,
      type: "booking_confirmation_required",
      title: `New booking - confirm by ${formatDateTime(deadline)}`,
      body: `${renterName} booked ${listing.title} for ${parsed.data.rental_units} ${parsed.data.pricing_period}. Confirm by ${formatDateTime(deadline)} or it auto-cancels.`,
      bookingId: createdBooking.id,
      listingId: listing.id,
      fromUserId: auth.user.id,
      actionUrl: `/lister/bookings/${createdBooking.id}`,
      metadata: {
        quantity: parsed.data.quantity,
        total_price: totalPrice,
        deadline,
      },
    }).catch((error) => {
      console.error("createAndPayBooking notification failed:", error);
    });

    revalidateBookingViews();
    return {
      paymentUrl: paymentResult.paymentUrl,
      bookingId: createdBooking.id,
    };
  } catch (error) {
    console.error("createAndPayBooking failed:", error);
    return {
      error:
        error instanceof Error
          ? error.message
          : "Something went wrong. Please try again.",
    };
  }
}

export async function listerConfirmBooking(
  bookingId: string,
): Promise<ActionResponse> {
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth) {
      return { error: "You must be signed in to confirm this booking." };
    }

    const booking = await getBookingRecord(auth.supabase, bookingId);
    if (booking.lister_id !== auth.user.id) {
      return { error: "Only the lister can confirm this booking." };
    }
    if (booking.status !== "lister_confirmation") {
      return { error: "Only bookings awaiting lister confirmation can be confirmed." };
    }
    if (
      booking.lister_confirmation_deadline &&
      new Date(booking.lister_confirmation_deadline).getTime() <= Date.now()
    ) {
      return { error: "The confirmation window has already expired." };
    }

    const confirmedAt = new Date().toISOString();
    const { error } = await auth.supabase
      .from("bookings")
      .update({
        status: "confirmed",
        lister_confirmed_at: confirmedAt,
        lister_confirmed_by: auth.user.id,
      })
      .eq("id", booking.id)
      .eq("status", "lister_confirmation");

    if (error) {
      return { error: error.message };
    }

    await addTimeline({
      bookingId: booking.id,
      status: "confirmed",
      previousStatus: "lister_confirmation",
      actorId: auth.user.id,
      actorRole: "lister",
      title: "Availability confirmed",
      description:
        "Lister confirmed they can fulfill this booking. Contact the renter to arrange handover.",
    });

    const listerName = getActorDisplayName(auth.profile, auth.user.email);
    void sendNotification({
      userId: booking.renter_id,
      type: "payment_confirmed",
      title: "Booking confirmed!",
      body: `${listerName} confirmed your booking. Contact them to arrange handover.`,
      bookingId: booking.id,
      listingId: booking.listing_id,
      fromUserId: auth.user.id,
      actionUrl: `/renter/rentals/${booking.id}`,
    }).catch((notificationError) => {
      console.error("listerConfirmBooking notification failed:", notificationError);
    });

    revalidateBookingViews();
    return { success: "Booking confirmed." };
  } catch (error) {
    console.error("listerConfirmBooking failed:", error);
    return { error: "Something went wrong. Please try again." };
  }
}

export async function listerCancelBooking(
  prevState: ActionResponse | FormData | null,
  formDataArg?: FormData,
): Promise<ActionResponse> {
  void prevState;

  try {
    const auth = await requireAuthenticatedUser();
    if (!auth) {
      return { error: "You must be signed in to cancel this booking." };
    }

    const formData = getFormData(prevState, formDataArg);
    if (!formData) {
      return { error: "Missing cancellation data." };
    }

    const parsed = listerCancelSchema.safeParse({
      booking_id: formData.get("booking_id"),
      reason: normalizeText(formData.get("reason")?.toString()),
    });

    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Invalid cancellation reason." };
    }

    const booking = await getBookingRecord(auth.supabase, parsed.data.booking_id);
    if (booking.lister_id !== auth.user.id) {
      return { error: "Only the lister can cancel this booking." };
    }
    if (!["lister_confirmation", "confirmed"].includes(booking.status)) {
      return { error: "This booking can no longer be cancelled by the lister." };
    }

    if (booking.stock_reserved && !booking.stock_restored) {
      await releaseStock(auth.supabase, booking, auth.user.id);
    }

    await updateBookingAsCancelled({
      supabase: auth.supabase,
      bookingId: booking.id,
      status: "cancelled_by_lister",
      actorId: auth.user.id,
      reason: parsed.data.reason,
      stockRestored: true,
      listingPausedDueToCancellation: true,
    });

    const { error: pauseError } = await auth.supabase
      .from("listings")
      .update({ status: "paused" })
      .eq("id", booking.listing_id);

    if (pauseError) {
      return { error: pauseError.message };
    }

    await addTimeline({
      bookingId: booking.id,
      status: "cancelled_by_lister",
      previousStatus: booking.status,
      actorId: auth.user.id,
      actorRole: "lister",
      title: "Lister cancelled booking",
      description: `${parsed.data.reason}. Full refund being processed. Listing paused.`,
      metadata: { listing_paused: true },
    });

    const refundResult = await processCancellationRefund(booking.id, {
      cancelledBy: "lister",
      refundReason: "booking_cancelled_by_lister",
    });
    if ("error" in refundResult) {
      console.error("listerCancelBooking refund failed:", refundResult.error);
    }

    void sendNotification({
      userId: booking.renter_id,
      type: "booking_cancelled",
      title: "Booking cancelled - full refund coming",
      body: `Lister cancelled. Reason: ${parsed.data.reason}. Full refund within 5-10 days.`,
      bookingId: booking.id,
      listingId: booking.listing_id,
      fromUserId: auth.user.id,
      actionUrl: `/renter/rentals/${booking.id}`,
      metadata: { refund_policy: "full_refund_lister_cancelled" },
    }).catch((notificationError) => {
      console.error("listerCancelBooking notification failed:", notificationError);
    });

    revalidateBookingViews();
    return { success: "Booking cancelled and listing paused." };
  } catch (error) {
    console.error("listerCancelBooking failed:", error);
    return { error: "Something went wrong. Please try again." };
  }
}

export async function confirmPayment(
  bookingId: string,
  paymentId?: string,
): Promise<ActionResponse> {
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth) {
      const admin = createAdminClient();
      return await confirmPaymentInternal({
        supabase: admin,
        bookingId,
        paymentId,
      });
    }

    const booking = await getBookingRecord(auth.supabase, bookingId);
    if (booking.renter_id !== auth.user.id && booking.lister_id !== auth.user.id) {
      return { error: "You are not allowed to confirm this payment." };
    }

    return await confirmPaymentInternal({
      supabase: auth.supabase,
      bookingId,
      paymentId,
    });
  } catch (error) {
    console.error("confirmPayment failed:", error);
    return { error: "Something went wrong. Please try again." };
  }
}

export async function confirmPaymentFromWebhook(
  bookingId: string,
  paymentId?: string,
): Promise<ActionResponse> {
  try {
    const admin = createAdminClient();
    return await confirmPaymentInternal({
      supabase: admin,
      bookingId,
      paymentId,
    });
  } catch (error) {
    console.error("confirmPaymentFromWebhook failed:", error);
    return { error: "Could not confirm payment from webhook." };
  }
}

export async function markReceivedByRenter(
  prevState: ActionResponse | FormData | null,
  formDataArg?: FormData,
): Promise<ActionResponse> {
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth) {
      return { error: "You must be signed in to mark handover." };
    }

    const formData = getFormData(prevState, formDataArg);
    if (!formData) {
      return { error: "Missing handover form data." };
    }

    const bookingId = normalizeText(formData.get("booking_id")?.toString());
    if (!bookingId) {
      return { error: "booking_id is required." };
    }

    const booking = await getBookingRecord(auth.supabase, bookingId);
    if (booking.lister_id !== auth.user.id) {
      return { error: "Only the lister can mark item handover." };
    }
    if (booking.status !== "confirmed") {
      return { error: "Only confirmed bookings can start rental period." };
    }

    const proofFiles = formData
      .getAll("proof_photos")
      .filter((entry): entry is File => entry instanceof File && entry.size > 0);
    const notes = normalizeText(formData.get("notes")?.toString());
    const photoUrls = await uploadProofPhotos(booking.id, "handover", proofFiles);

    let rentalEndsAt: string | null = null;

    try {
      const rpcData = await callRpcWithFallbacks<unknown>(
        auth.supabase,
        "start_rental_period",
        [
          {
            p_booking_id: booking.id,
            p_user_id: auth.user.id,
            p_photo_urls: photoUrls,
            p_notes: notes ?? null,
          },
          {
            booking_id: booking.id,
            user_id: auth.user.id,
            photo_urls: photoUrls,
            notes: notes ?? null,
          },
          {
            p_booking_id: booking.id,
            p_user_id: auth.user.id,
          },
          {
            booking_id: booking.id,
            user_id: auth.user.id,
          },
        ],
      );

      rentalEndsAt = extractRpcDateTime(rpcData);
      if (!rentalEndsAt) {
        const { data: refreshed } = await auth.supabase
          .from("bookings")
          .select("rental_ends_at")
          .eq("id", booking.id)
          .maybeSingle<{ rental_ends_at: string | null }>();
        rentalEndsAt = refreshed?.rental_ends_at ?? null;
      }
    } catch (error) {
      if (!isMissingRpcSignatureError(error, "start_rental_period")) {
        throw error;
      }

      rentalEndsAt = await startRentalPeriodDirect({
        supabase: auth.supabase,
        booking,
        userId: auth.user.id,
        notes,
        photoUrls,
      });
    }

    if (rentalEndsAt) {
      void notifyRentalStarted({
        renterId: booking.renter_id,
        listingTitle: booking.listing.title,
        bookingId: booking.id,
        rentalEndsAt,
      }).catch((error) => {
        console.error("markReceivedByRenter notification failed:", error);
      });
    }

    revalidateBookingViews();
    return {
      success: `Item marked as received! Rental period started. Return deadline: ${formatDateTime(rentalEndsAt)}.`,
    };
  } catch (error) {
    console.error("markReceivedByRenter failed:", error);
    return {
      error:
        error instanceof Error
          ? error.message
          : "Could not start rental period. Please try again.",
    };
  }
}

export async function markReturnedToLister(
  prevState: ActionResponse | FormData | null,
  formDataArg?: FormData,
): Promise<ActionResponse> {
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth) {
      return { error: "You must be signed in to mark return." };
    }

    const formData = getFormData(prevState, formDataArg);
    if (!formData) {
      return { error: "Missing return form data." };
    }

    const bookingId = normalizeText(formData.get("booking_id")?.toString());
    if (!bookingId) {
      return { error: "booking_id is required." };
    }

    const booking = await getBookingRecord(auth.supabase, bookingId);
    if (booking.renter_id !== auth.user.id) {
      return { error: "Only the renter can mark item return." };
    }
    if (booking.status !== "active") {
      return { error: "Only active rentals can be marked returned." };
    }

    const proofFiles = formData
      .getAll("proof_photos")
      .filter((entry): entry is File => entry instanceof File && entry.size > 0);
    const notes = normalizeText(formData.get("notes")?.toString());
    const photoUrls = await uploadProofPhotos(booking.id, "return", proofFiles);

    let isLateReturn = false;

    try {
      const rpcData = await callRpcWithFallbacks(
        auth.supabase,
        "mark_item_returned_by_renter",
        [
          {
            p_booking_id: booking.id,
            p_user_id: auth.user.id,
            p_photo_urls: photoUrls,
            p_notes: notes ?? null,
          },
          {
            booking_id: booking.id,
            user_id: auth.user.id,
            photo_urls: photoUrls,
            notes: notes ?? null,
          },
        ],
      );

      isLateReturn = Boolean(
        rpcData &&
          typeof rpcData === "object" &&
          "is_late" in rpcData &&
          (rpcData as { is_late?: unknown }).is_late,
      );
    } catch (error) {
      if (!isMissingRpcSignatureError(error, "mark_item_returned_by_renter")) {
        throw error;
      }

      isLateReturn = await markReturnToListerDirect({
        supabase: auth.supabase,
        booking,
        userId: auth.user.id,
        notes,
        photoUrls,
      });
    }

    void notifyItemReturned({
      listerId: booking.lister_id,
      renterName:
        auth.profile?.display_name || getActorDisplayName(auth.profile, auth.user.email),
      listingTitle: booking.listing.title,
      bookingId: booking.id,
      isLate: isLateReturn,
    }).catch((error) => {
      console.error("markReturnedToLister notification failed:", error);
    });

    revalidateBookingViews();
    return {
      success: "Item marked as returned! Waiting for lister to inspect.",
    };
  } catch (error) {
    console.error("markReturnedToLister failed:", error);
    return {
      error:
        error instanceof Error
          ? error.message
          : "Could not mark item return. Please try again.",
    };
  }
}

export async function confirmReturnAndComplete(
  prevState: ActionResponse | FormData | null,
  formDataArg?: FormData,
): Promise<ActionResponse> {
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth) {
      return { error: "You must be signed in to complete booking." };
    }

    const formData = getFormData(prevState, formDataArg);
    if (!formData) {
      return { error: "Missing completion form data." };
    }

    const parsed = confirmReturnSchema.safeParse({
      booking_id: formData.get("booking_id"),
      return_condition: formData.get("return_condition"),
      return_condition_notes: normalizeText(
        formData.get("return_condition_notes")?.toString(),
      ),
    });
    if (!parsed.success) {
      return {
        error: parsed.error.issues[0]?.message ?? "Invalid return confirmation.",
      };
    }

    const booking = await getBookingRecord(auth.supabase, parsed.data.booking_id);
    if (booking.lister_id !== auth.user.id) {
      return { error: "Only the lister can complete this booking." };
    }
    if (booking.status !== "returned") {
      return { error: "Only returned bookings can be completed." };
    }

    if ((booking.stock_reserved || booking.stock_deducted) && !booking.stock_restored) {
      await returnStock(auth.supabase, booking, auth.user.id);
    }

    const { error: updateError } = await auth.supabase
      .from("bookings")
      .update({
        status: "completed",
        return_condition: parsed.data.return_condition,
        return_condition_notes: parsed.data.return_condition_notes ?? null,
        stock_restored: true,
      })
      .eq("id", booking.id);

    if (updateError) {
      return { error: updateError.message };
    }
    const depositRequiresReview =
      parsed.data.return_condition === "damaged" ||
      parsed.data.return_condition === "missing_parts";

    const payoutResult = await autoTriggerPayout(booking.id);
    if (!payoutResult.success) {
      console.error(
        "confirmReturnAndComplete autoTriggerPayout failed:",
        payoutResult.error,
      );
    }

    const notesText = parsed.data.return_condition_notes
      ? ` ${parsed.data.return_condition_notes}`
      : "";
    await addTimeline({
      bookingId: booking.id,
      status: "completed",
      previousStatus: "returned",
      actorId: auth.user.id,
      actorRole: "lister",
      title: "Rental completed",
      description: depositRequiresReview
        ? `Item condition: ${parsed.data.return_condition}.${notesText} Stock restored. Deposit review is required before any deposit disposition.`
        : payoutResult.success
          ? `Item condition: ${parsed.data.return_condition}.${notesText} Stock restored. Deposit released with no claim and payout flow has been queued for processing.`
          : `Item condition: ${parsed.data.return_condition}.${notesText} Stock restored. Deposit released with no claim, but payout creation needs attention: ${payoutResult.error}`,
      metadata: {
        return_condition: parsed.data.return_condition,
        payout_amount: booking.lister_payout,
        deposit_amount: booking.deposit_amount,
        deposit_review_required: depositRequiresReview,
        payout_error: payoutResult.success ? null : payoutResult.error,
      },
    });

    if (depositRequiresReview) {
      const admin = createAdminClient();
      const { data: admins } = await admin
        .from("profiles")
        .select("id")
        .eq("is_admin", true);

      const reviewMessage = `Deposit of ${formatMoney(booking.deposit_amount ?? 0)} is being reviewed due to reported damage`;

      await Promise.all([
        createNotification({
          userId: booking.renter_id,
          type: "return_condition_issue",
          title: "Deposit under review",
          body: reviewMessage,
          listingId: booking.listing_id,
          bookingId: booking.id,
          fromUserId: auth.user.id,
          actionUrl: `/dashboard/bookings/${booking.id}`,
        }),
        ...((admins ?? []) as Array<{ id: string }>).map((adminProfile) =>
          createNotification({
            userId: adminProfile.id,
            type: "admin_alert",
            title: "Deposit review required",
            body: reviewMessage,
            listingId: booking.listing_id,
            bookingId: booking.id,
            fromUserId: auth.user.id,
            actionUrl: `/admin/bookings/${booking.id}`,
          }),
        ),
      ]);
    }

    void notifyBookingCompleted({
      renterId: booking.renter_id,
      listerId: booking.lister_id,
      listingTitle: booking.listing.title,
      bookingId: booking.id,
    }).catch((error) => {
      console.error("confirmReturnAndComplete notification failed:", error);
    });

    revalidateBookingViews();
    return {
      success: payoutResult.success
        ? "Booking completed successfully."
        : "Booking completed, but payout could not be created automatically.",
    };
  } catch (error) {
    console.error("confirmReturnAndComplete failed:", error);
    return { error: "Something went wrong. Please try again." };
  }
}

export async function cancelBookingAsRenter(
  prevState: ActionResponse | FormData | null,
  formDataArg?: FormData,
): Promise<ActionResponse> {
  void prevState;

  try {
    const auth = await requireAuthenticatedUser();
    if (!auth) {
      return { error: "You must be signed in to cancel this booking." };
    }

    const formData = getFormData(prevState, formDataArg);
    if (!formData) {
      return { error: "Missing cancellation data." };
    }

    const bookingId = normalizeText(formData.get("booking_id")?.toString());
    const reason =
      normalizeText(formData.get("reason")?.toString()) ??
      "Cancelled by renter.";

    if (!bookingId) {
      return { error: "booking_id is required." };
    }

    const booking = await getBookingRecord(auth.supabase, bookingId);
    if (booking.renter_id !== auth.user.id) {
      return { error: "Only the renter can cancel this booking." };
    }
    if (booking.status === "active" || booking.status === "returned") {
      return { error: "Cannot cancel active rental. Raise a dispute." };
    }
    if (!["lister_confirmation", "confirmed"].includes(booking.status)) {
      return { error: "This booking can no longer be cancelled." };
    }

    const hoursSincePaid = booking.paid_at
      ? differenceInHours(new Date(), new Date(booking.paid_at))
      : 0;

    let refundAmount = booking.total_price;
    let refundPercent = 100;
    let policyLabel = "100% refund";

    if (hoursSincePaid <= 12) {
      refundAmount = booking.total_price;
    } else if (hoursSincePaid <= 24) {
      refundAmount = roundMoney(booking.subtotal * 0.5 + booking.deposit_amount);
      refundPercent = 50;
      policyLabel = "50% rental refund + full deposit";
    } else {
      refundAmount = roundMoney(booking.deposit_amount);
      refundPercent = 0;
      policyLabel = "Deposit only";
    }

    if (booking.stock_reserved && !booking.stock_restored) {
      await releaseStock(auth.supabase, booking, auth.user.id);
    }

    await updateBookingAsCancelled({
      supabase: auth.supabase,
      bookingId: booking.id,
      status: "cancelled_by_renter",
      actorId: auth.user.id,
      reason,
      stockRestored: true,
    });

    await addTimeline({
      bookingId: booking.id,
      status: "cancelled_by_renter",
      previousStatus: booking.status,
      actorId: auth.user.id,
      actorRole: "renter",
      title: "Renter cancelled booking",
      description: `${reason}. Refund policy applied: ${policyLabel}. Refund amount: ${formatMoney(refundAmount)}.`,
      metadata: {
        refund_amount: refundAmount,
        refund_percent: refundPercent,
        hours_since_paid: hoursSincePaid,
      },
    });

    const refundResult = await processCancellationRefund(booking.id, {
      cancelledBy: "renter",
      refundReason: "booking_cancelled_by_renter",
      refundAmountOverride: refundAmount,
      policyAppliedOverride:
        refundPercent === 100
          ? "renter_cancel_0_12_hours"
          : refundPercent === 50
            ? "renter_cancel_12_24_hours"
            : "renter_cancel_over_24_hours",
      reasonOverride: `Renter cancellation policy applied: ${policyLabel}.`,
    });
    if ("error" in refundResult) {
      console.error("cancelBookingAsRenter refund failed:", refundResult.error);
    }

    const renterName = getActorDisplayName(auth.profile, auth.user.email);
    void sendNotification({
      userId: booking.lister_id,
      type: "booking_cancelled",
      title: "Renter cancelled booking",
      body: `${renterName} cancelled. Stock released.`,
      bookingId: booking.id,
      listingId: booking.listing_id,
      fromUserId: auth.user.id,
      actionUrl: `/lister/bookings/${booking.id}`,
    }).catch((notificationError) => {
      console.error("cancelBookingAsRenter notification failed:", notificationError);
    });

    revalidateBookingViews();
    return {
      success: `Booking cancelled. Refund of $${refundAmount.toFixed(2)} (${refundPercent}%) will be processed in 5-10 business days.`,
    };
  } catch (error) {
    console.error("cancelBookingAsRenter failed:", error);
    return { error: "Something went wrong. Please try again." };
  }
}

export async function raiseDispute(
  bookingId: string,
  reason: string,
): Promise<ActionResponse> {
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth) {
      return { error: "You must be signed in to raise a dispute." };
    }

    const disputeReason = normalizeText(reason);
    if (!disputeReason) {
      return { error: "A dispute reason is required." };
    }

    const booking = await getBookingRecord(auth.supabase, bookingId);
    const actorRole = getRoleForBooking(booking, auth.user.id);
    if (!actorRole) {
      return { error: "You are not allowed to dispute this booking." };
    }

    if (booking.status !== "active" && booking.status !== "returned") {
      return { error: "Only active or returned bookings can be disputed." };
    }

    const previousStatus = booking.status;
    const { error: updateError } = await auth.supabase
      .from("bookings")
      .update({ status: "disputed" })
      .eq("id", booking.id);

    if (updateError) {
      return { error: updateError.message };
    }

    await addTimeline({
      bookingId: booking.id,
      status: "disputed",
      previousStatus,
      actorId: auth.user.id,
      actorRole,
      title: "Dispute raised",
      description: `${getActorDisplayName(actorRole === "renter" ? booking.renter : booking.lister, auth.user.email)} raised a dispute. Reason: ${disputeReason}`,
      metadata: { reason: disputeReason },
    });

    const adminIds = await getAdminIds();
    const raisedByName =
      auth.profile?.display_name || getActorDisplayName(auth.profile, auth.user.email);
    const otherPartyId =
      actorRole === "renter" ? booking.lister_id : booking.renter_id;
    const otherPartyActionUrl =
      actorRole === "renter"
        ? `/lister/bookings/${booking.id}`
        : `/renter/rentals/${booking.id}`;

    await Promise.all([
      sendNotification({
        userId: otherPartyId,
        type: "dispute_raised",
        title: "Dispute raised on your booking",
        body: `${raisedByName} raised a dispute on the booking for "${booking.listing.title}". An admin will review it shortly.`,
        bookingId: booking.id,
        listingId: booking.listing_id,
        fromUserId: auth.user.id,
        actionUrl: otherPartyActionUrl,
      }),
      ...adminIds.map((adminId) =>
        sendNotification({
          userId: adminId,
          type: "dispute_raised",
          title: `Dispute requires review - $${booking.total_price} at stake`,
          body: `${raisedByName} raised a dispute on booking for "${booking.listing.title}".`,
          bookingId: booking.id,
          listingId: booking.listing_id,
          fromUserId: auth.user.id,
          actionUrl: `/admin/bookings/${booking.id}`,
        }),
      ),
    ]);

    await holdPaymentForDispute(booking.id);

    revalidateBookingViews();
    return { success: "Dispute raised." };
  } catch (error) {
    console.error("raiseDispute failed:", error);
    return { error: "Something went wrong. Please try again." };
  }
}

export async function getIncomingBookings(
  userId: string,
  status?: BookingStatus,
): Promise<BookingWithDetails[]> {
  try {
    await processExpiredUnconfirmedBookingsIfNeeded();
    const supabase = await createClient();
    let query = supabase
      .from("bookings")
      .select(
        `
          *,
          listing:listings!bookings_listing_id_fkey(*),
          renter:profiles!bookings_renter_id_fkey(*),
          lister:profiles!bookings_lister_id_fkey(*)
        `,
      )
      .eq("lister_id", userId)
      .order("created_at", { ascending: false });

    if (status) {
      query = query.eq("status", status);
    }

    const { data, error } = await query;
    if (error) {
      throw error;
    }

    return (data ?? []).flatMap((booking) => {
      const typed = booking as BookingRecord;
      const listing = unwrapRelation(typed.listing);
      const renter = unwrapRelation(typed.renter);
      const lister = unwrapRelation(typed.lister);
      if (!listing || !renter || !lister) {
        return [];
      }

      return [{ ...(booking as Booking), listing, renter, lister }];
    });
  } catch (error) {
    console.error("getIncomingBookings failed:", error);
    return [];
  }
}

export async function getMyRentals(
  userId: string,
  status?: BookingStatus,
): Promise<BookingWithDetails[]> {
  try {
    await processExpiredUnconfirmedBookingsIfNeeded();
    const supabase = await createClient();
    let query = supabase
      .from("bookings")
      .select(
        `
          *,
          listing:listings!bookings_listing_id_fkey(*),
          renter:profiles!bookings_renter_id_fkey(*),
          lister:profiles!bookings_lister_id_fkey(*)
        `,
      )
      .eq("renter_id", userId)
      .order("created_at", { ascending: false });

    if (status) {
      query = query.eq("status", status);
    }

    const { data, error } = await query;
    if (error) {
      throw error;
    }

    return (data ?? []).flatMap((booking) => {
      const typed = booking as BookingRecord;
      const listing = unwrapRelation(typed.listing);
      const renter = unwrapRelation(typed.renter);
      const lister = unwrapRelation(typed.lister);
      if (!listing || !renter || !lister) {
        return [];
      }

      return [{ ...(booking as Booking), listing, renter, lister }];
    });
  } catch (error) {
    console.error("getMyRentals failed:", error);
    return [];
  }
}

export async function getBookingDetails(
  bookingId: string,
): Promise<BookingWithDetails | null> {
  try {
    await processExpiredUnconfirmedBookingsIfNeeded();
    const supabase = await createClient();
    const booking = await getBookingRecord(supabase, bookingId);
    const timeline = await getBookingTimeline(bookingId);

    return {
      ...(booking as Booking),
      listing: booking.listing,
      renter: booking.renter,
      lister: booking.lister,
      timeline,
    };
  } catch (error) {
    console.error("getBookingDetails failed:", error);
    return null;
  }
}

export async function getBookingTimeline(
  bookingId: string,
): Promise<BookingTimelineWithActor[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("booking_timeline")
      .select("*")
      .eq("booking_id", bookingId)
      .order("created_at", { ascending: true });

    if (error) {
      throw error;
    }

    const timeline = (data ?? []) as BookingTimeline[];
    const actorIds = Array.from(
      new Set(
        timeline
          .map((entry) => entry.actor_id)
          .filter((value): value is string => Boolean(value)),
      ),
    );

    let actorMap = new Map<string, Profile>();
    if (actorIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("*")
        .in("id", actorIds);

      actorMap = new Map(
        ((profiles ?? []) as Profile[]).map((profile) => [profile.id, profile]),
      );
    }

    return timeline.map((entry) => ({
      ...entry,
      actor: entry.actor_id ? actorMap.get(entry.actor_id) : undefined,
    }));
  } catch (error) {
    console.error("getBookingTimeline failed:", error);
    return [];
  }
}

async function _expireUnconfirmedBookingsLegacy(): Promise<ActionResponse> {
  try {
    const admin = createAdminClient();
    const now = new Date().toISOString();
    const { data: expiringBookings } = await admin
      .from("bookings")
      .select("id")
      .eq("status", "lister_confirmation")
      .lt("lister_confirmation_deadline", now);

    await Promise.all(
      ((expiringBookings ?? []) as Array<{
        id: string;
        renter_id: string;
        listing_id: string;
      }>).map((booking) =>
        createNotification({
          userId: booking.renter_id,
          type: "booking_expired",
          title: "Booking cancelled",
          body: "Booking cancelled — payment not completed in time",
          listingId: booking.listing_id,
          bookingId: booking.id,
          actionUrl: `/dashboard/bookings/${booking.id}`,
        }),
      ),
    );

    revalidateBookingViews();
    return { success: "Expired unpaid bookings." };
  } catch (error) {
    console.error("expireUnpaidBookings failed:", error);
    return { error: "Could not expire unpaid bookings." };
  }
}

void _expireUnconfirmedBookingsLegacy;

export async function expireUnconfirmedBookings(): Promise<ActionResponse> {
  try {
    const admin = createAdminClient();
    const now = new Date().toISOString();
    const { data: expiringBookings } = await admin
      .from("bookings")
      .select("id")
      .eq("status", "lister_confirmation")
      .lt("lister_confirmation_deadline", now);

    for (const booking of (expiringBookings ?? []) as Array<{ id: string }>) {
      const fullBooking = await getBookingRecord(admin, booking.id);

      if (fullBooking.stock_reserved && !fullBooking.stock_restored) {
        await releaseStock(admin, fullBooking, fullBooking.lister_id);
      }

      await updateBookingAsCancelled({
        supabase: admin,
        bookingId: booking.id,
        status: "cancelled_by_lister",
        reason: "Lister did not confirm within 24 hours.",
        autoCancelledReason: "lister_confirmation_expired",
        stockRestored: true,
        listingPausedDueToCancellation: true,
      });

      await admin
        .from("listings")
        .update({ status: "paused" })
        .eq("id", fullBooking.listing_id);

      await addTimeline({
        bookingId: booking.id,
        status: "cancelled_by_lister",
        previousStatus: "lister_confirmation",
        actorRole: "system",
        title: "Booking auto-cancelled",
        description:
          "Lister did not confirm within 24 hours. Full refund being processed and listing paused.",
        metadata: {
          listing_paused: true,
          auto_cancelled_reason: "lister_confirmation_expired",
        },
      });

      const refundResult = await processCancellationRefund(booking.id, {
        cancelledBy: "lister",
        refundReason: "booking_cancelled_by_lister",
      });
      if ("error" in refundResult) {
        console.error("expireUnconfirmedBookings refund failed:", refundResult.error);
      }

      await sendNotification({
        userId: fullBooking.renter_id,
        type: "booking_cancelled",
        title: "Booking cancelled - full refund coming",
        body: "Lister did not confirm within 24 hours. Full refund within 5-10 days.",
        listingId: fullBooking.listing_id,
        bookingId: booking.id,
        actionUrl: `/renter/rentals/${booking.id}`,
        metadata: { auto_cancelled_reason: "lister_confirmation_expired" },
      });
    }

    revalidateBookingViews();
    return { success: "Expired unconfirmed bookings." };
  } catch (error) {
    console.error("expireUnconfirmedBookings failed:", error);
    return { error: "Could not expire unconfirmed bookings." };
  }
}

async function processExpiredUnconfirmedBookingsIfNeeded() {
  const result = await expireUnconfirmedBookings();
  if (result.error) {
    console.error("processExpiredUnconfirmedBookingsIfNeeded failed:", result.error);
  }
}

// Compatibility wrappers for existing UI until components are migrated.
export async function markOutForDelivery(
  bookingId: string,
  _notes?: string,
): Promise<ActionResponse> {
  void _notes;
  return markItemHandedOver(bookingId);
}

export async function markItemHandedOver(
  bookingId: string,
): Promise<ActionResponse> {
  void bookingId;
  return {
    error:
      "This action now requires photo proof. Use the handover proof submission flow.",
  };
}

export async function initiateReturn(
  prevState: ActionResponse | FormData | null,
  formDataArg?: FormData,
): Promise<ActionResponse> {
  void prevState;
  void formDataArg;
  return {
    error:
      "Return scheduling has been replaced. Submit return proof photos to mark item returned.",
  };
}

export async function markItemReturned(
  bookingId: string,
): Promise<ActionResponse> {
  void bookingId;
  return {
    error:
      "This action now requires return photo proof. Use the return proof submission flow.",
  };
}

export async function completeBooking(
  bookingId: string,
): Promise<ActionResponse> {
  void bookingId;
  return {
    error:
      "Use condition inspection to complete booking after the renter marks return.",
  };
}
