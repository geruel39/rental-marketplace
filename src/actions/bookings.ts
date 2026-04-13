"use server";

import { revalidatePath } from "next/cache";
import { addHours, format } from "date-fns";

import { createNotification } from "@/actions/notifications";
import {
  autoTriggerPayout,
  createPaymentForBooking,
  handlePaymentConfirmed,
  holdPaymentForDispute,
  processCancellationRefund,
} from "@/actions/payments";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { bookingRequestSchema, confirmReturnSchema } from "@/lib/validations";
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
type BookingActionResponse = ActionResponse & {
  bookingId?: string;
  paymentUrl?: string | null;
};
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

  await createNotification({
    userId: params.booking.renter_id,
    type: "rental_started",
    title: "Rental started",
    body: "The lister confirmed handover. Your rental period is now active.",
    listingId: params.booking.listing_id,
    bookingId: params.booking.id,
    fromUserId: params.userId,
    actionUrl: `/dashboard/bookings/${params.booking.id}`,
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

  await createNotification({
    userId: params.booking.lister_id,
    type: "booking_returned",
    title: "Item returned",
    body: isLateReturn
      ? "The renter marked the item as returned after the deadline. Please inspect it."
      : "The renter marked the item as returned. Please inspect it and complete the booking.",
    listingId: params.booking.listing_id,
    bookingId: params.booking.id,
    fromUserId: params.userId,
    actionUrl: `/dashboard/bookings/${params.booking.id}`,
  });
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
    .maybeSingle<BookingRecord>();

  if (error || !data) {
    throw new Error("Booking not found");
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

async function acceptBookingRequestInternal(params: {
  supabase: AnySupabaseClient;
  bookingId: string;
  actorId: string;
  skipListerCheck?: boolean;
}): Promise<BookingActionResponse> {
  const booking = await getBookingRecord(params.supabase, params.bookingId);

  if (!params.skipListerCheck && booking.lister_id !== params.actorId) {
    return { error: "Only the lister can accept this booking request." };
  }

  if (booking.status !== "pending") {
    return { error: "Only pending bookings can be accepted." };
  }

  if (booking.listing.track_inventory) {
    const available = booking.listing.quantity_available ?? 0;
    if (available < booking.quantity) {
      return {
        error: `Not enough stock available (${available} available, you requested ${booking.quantity})`,
      };
    }
  }

  await reserveStock(params.supabase, booking, params.actorId);

  const paymentExpiresAt = addHours(new Date(), PAYMENT_EXPIRY_HOURS).toISOString();
  const { error: updateError } = await params.supabase
    .from("bookings")
    .update({
      status: "awaiting_payment",
      stock_reserved: true,
      stock_reserved_at: new Date().toISOString(),
      payment_expires_at: paymentExpiresAt,
    })
    .eq("id", booking.id);

  if (updateError) {
    return { error: updateError.message };
  }

  await addTimeline({
    bookingId: booking.id,
    status: "awaiting_payment",
    previousStatus: "pending",
    actorId: params.actorId,
    actorRole: "lister",
    title: "Booking accepted",
    description: `Lister accepted the request. Stock reserved. Renter must complete payment by ${formatDateTime(paymentExpiresAt)}.`,
    metadata: { payment_expires_at: paymentExpiresAt },
  });

  const paymentResult = await createPaymentForBooking(booking.id);
  if ("error" in paymentResult) {
    return { error: paymentResult.error };
  }

  await createNotification({
    userId: booking.renter_id,
    type: "booking_accepted",
    title: "Booking accepted - payment required",
    body: `Your booking has been accepted! Complete payment to confirm. Payment link: ${paymentResult.paymentUrl}`,
    listingId: booking.listing_id,
    bookingId: booking.id,
    fromUserId: booking.lister_id,
    actionUrl: paymentResult.paymentUrl,
  });

  revalidateBookingViews();

  return {
    success: "Booking accepted. Payment link created.",
    paymentUrl: paymentResult.paymentUrl,
    bookingId: booking.id,
  };
}

async function confirmPaymentInternal(params: {
  supabase: AnySupabaseClient;
  bookingId: string;
  paymentId?: string;
}): Promise<ActionResponse> {
  const booking = await getBookingRecord(params.supabase, params.bookingId);

  if (booking.status !== "awaiting_payment") {
    if (booking.status === "confirmed" || booking.hitpay_payment_status === "completed") {
      return { success: "Payment already confirmed." };
    }
    return { error: "Only bookings awaiting payment can be confirmed." };
  }

  const paidAt = new Date().toISOString();
  const { error: updateError } = await params.supabase
    .from("bookings")
    .update({
      status: "confirmed",
      paid_at: paidAt,
      hitpay_payment_id: params.paymentId ?? booking.hitpay_payment_id,
      hitpay_payment_status: "completed",
      stock_deducted: true,
    })
    .eq("id", booking.id);

  if (updateError) {
    return { error: updateError.message };
  }

  await addTimeline({
    bookingId: booking.id,
    status: "confirmed",
    previousStatus: "awaiting_payment",
    actorId: null,
    actorRole: "system",
    title: "Payment confirmed",
    description: `Payment of ${formatMoney(booking.total_price)} received. The lister will arrange to hand over the item. Use messages to coordinate.`,
    metadata: {
      payment_id: params.paymentId ?? null,
      amount: booking.total_price,
    },
  });

  await Promise.all([
    createNotification({
      userId: booking.lister_id,
      type: "payment_received",
      title: "Payment received",
      body: "Payment received! Please arrange handover with the renter and mark the item as received when done.",
      listingId: booking.listing_id,
      bookingId: booking.id,
      fromUserId: booking.renter_id,
      actionUrl: `/dashboard/bookings/${booking.id}`,
    }),
    createNotification({
      userId: booking.renter_id,
      type: "payment_confirmed",
      title: "Payment confirmed",
      body: "Payment confirmed! Contact the lister to arrange item handover.",
      listingId: booking.listing_id,
      bookingId: booking.id,
      fromUserId: booking.lister_id,
      actionUrl: `/dashboard/bookings/${booking.id}`,
    }),
  ]);

  revalidateBookingViews();
  return { success: "Payment confirmed." };
}

export async function createBookingRequest(
  prevState: ActionResponse | FormData | null,
  formDataArg?: FormData,
): Promise<BookingActionResponse> {
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth) {
      return { error: "You must be signed in to create a booking." };
    }

    const formData = getFormData(prevState, formDataArg);
    if (!formData) {
      return { error: "Missing booking form data." };
    }

    const parsed = bookingRequestSchema.safeParse({
      listing_id: formData.get("listing_id"),
      rental_units: formData.get("rental_units"),
      quantity: formData.get("quantity"),
      pricing_period: formData.get("pricing_period"),
      message: normalizeText(formData.get("message")?.toString()),
    });

    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Invalid booking request." };
    }

    const listing = await getListingRecord(auth.supabase, parsed.data.listing_id);
    if (listing.owner_id === auth.user.id) {
      return { error: "You cannot book your own listing." };
    }

    if (listing.status !== "active") {
      return { error: "This listing is not available for booking." };
    }

    if (listing.track_inventory) {
      const available = listing.quantity_available ?? 0;
      if (available < parsed.data.quantity) {
        return {
          error: `Not enough stock available (${available} available, you requested ${parsed.data.quantity})`,
        };
      }
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
    const depositAmount = roundMoney((listing.deposit_amount ?? 0) * parsed.data.quantity);
    const totalPrice = roundMoney(subtotal + serviceFeeRenter + depositAmount);
    const listerPayout = roundMoney(subtotal - serviceFeeLister);

    const { data: createdBooking, error: insertError } = await auth.supabase
      .from("bookings")
      .insert({
        listing_id: listing.id,
        renter_id: auth.user.id,
        lister_id: listing.owner_id,
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
        status: "pending",
        start_date: null,
        end_date: null,
        fulfillment_type: null,
        stock_deducted: false,
        stock_reserved: false,
        stock_restored: false,
        handover_proof_urls: [],
        return_proof_urls: [],
        message: parsed.data.message ?? null,
      })
      .select("id")
      .maybeSingle<{ id: string }>();

    if (insertError || !createdBooking) {
      return { error: insertError?.message ?? "Failed to create booking request." };
    }

    const renterName = getActorDisplayName(auth.profile, auth.user.email);
    await addTimeline({
      bookingId: createdBooking.id,
      status: "pending",
      actorId: auth.user.id,
      actorRole: "renter",
      title: "Booking request submitted",
      description: `${renterName} requested to rent ${listing.title} for ${parsed.data.rental_units} ${parsed.data.pricing_period}(s), quantity: ${parsed.data.quantity}. Total: ${formatMoney(totalPrice)}.`,
      metadata: {
        rental_units: parsed.data.rental_units,
        pricing_period: parsed.data.pricing_period,
        quantity: parsed.data.quantity,
        total_price: totalPrice,
      },
    });

    await createNotification({
      userId: listing.owner_id,
      type: "booking_request_received",
      title: "New booking request",
      body: `New booking request for ${listing.title} - ${parsed.data.rental_units} ${parsed.data.pricing_period}(s), ${formatMoney(totalPrice)}.`,
      listingId: listing.id,
      bookingId: createdBooking.id,
      fromUserId: auth.user.id,
      actionUrl: `/dashboard/bookings/${createdBooking.id}`,
    });

    if (listing.instant_book) {
      const acceptResult = await acceptBookingRequestInternal({
        supabase: auth.supabase,
        bookingId: createdBooking.id,
        actorId: listing.owner_id,
        skipListerCheck: true,
      });

      if (acceptResult.error) {
        return {
          success: "Booking request sent, but auto-accept failed. Lister can accept manually.",
          bookingId: createdBooking.id,
        };
      }

      return {
        success: "Booking request sent and auto-accepted!",
        bookingId: createdBooking.id,
        paymentUrl: acceptResult.paymentUrl ?? null,
      };
    }

    revalidateBookingViews();
    return { success: "Booking request sent!", bookingId: createdBooking.id };
  } catch (error) {
    console.error("createBookingRequest failed:", error);
    return { error: "Something went wrong. Please try again." };
  }
}

export async function acceptBookingRequest(
  bookingId: string,
): Promise<BookingActionResponse> {
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth) {
      return { error: "You must be signed in to accept a booking." };
    }

    return await acceptBookingRequestInternal({
      supabase: auth.supabase,
      bookingId,
      actorId: auth.user.id,
    });
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
    const auth = await requireAuthenticatedUser();
    if (!auth) {
      return { error: "You must be signed in to decline a booking." };
    }

    const booking = await getBookingRecord(auth.supabase, bookingId);
    if (booking.lister_id !== auth.user.id) {
      return { error: "Only the lister can decline this booking." };
    }
    if (booking.status !== "pending" && booking.status !== "awaiting_payment") {
      return { error: "Only pending or awaiting payment bookings can be declined." };
    }

    const now = new Date().toISOString();
    const declineReason = normalizeText(reason) ?? "Declined by lister.";
    let stockRestored = booking.stock_restored;
    if ((booking.stock_reserved || booking.stock_deducted) && !booking.stock_restored) {
      await releaseStock(auth.supabase, booking, auth.user.id);
      stockRestored = true;
    }

    const { error: updateError } = await auth.supabase
      .from("bookings")
      .update({
        status: "cancelled_by_lister",
        cancelled_at: now,
        cancelled_by: auth.user.id,
        cancellation_reason: declineReason,
        stock_restored: stockRestored,
      })
      .eq("id", booking.id);

    if (updateError) {
      return { error: updateError.message };
    }

    await addTimeline({
      bookingId: booking.id,
      status: "cancelled_by_lister",
      previousStatus: "pending",
      actorId: auth.user.id,
      actorRole: "lister",
        title: "Booking declined",
        description: `Lister declined the request. Reason: ${declineReason}`,
        metadata: { reason: declineReason, stock_released: stockRestored },
    });

    await createNotification({
      userId: booking.renter_id,
      type: "booking_declined",
      title: "Booking request declined",
      body: `Your booking request was declined. Reason: ${declineReason}`,
      listingId: booking.listing_id,
      bookingId: booking.id,
      fromUserId: auth.user.id,
      actionUrl: `/dashboard/bookings/${booking.id}`,
    });

    let successMessage = "Booking request declined.";
    if (booking.paid_at) {
      const refundResult = await processCancellationRefund(booking.id, {
        refundReason: "booking_declined",
        cancelledBy: "lister",
      });

      if ("error" in refundResult) {
        successMessage = `Booking request declined. Refund needs attention: ${refundResult.error}`;
      } else {
        successMessage = `${successMessage} ${refundResult.message}`;
      }
    }

    revalidateBookingViews();
    return { success: successMessage };
  } catch (error) {
    console.error("declineBookingRequest failed:", error);
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
      return { error: "You must be signed in to confirm payment." };
    }

    const booking = await getBookingRecord(auth.supabase, bookingId);
    const role = getRoleForBooking(booking, auth.user.id);
    if (!role) {
      return { error: "You are not allowed to confirm this booking payment." };
    }

    await handlePaymentConfirmed({
      hitpayPaymentId: paymentId ?? booking.hitpay_payment_id ?? "",
      hitpayPaymentRequestId: booking.hitpay_payment_request_id ?? "",
      bookingId,
      amount: booking.net_collected ?? booking.total_price,
      currency: "SGD",
    });
    return { success: "Payment confirmed." };
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
    const booking = await getBookingRecord(admin, bookingId);
    await handlePaymentConfirmed({
      hitpayPaymentId: paymentId ?? booking.hitpay_payment_id ?? "",
      hitpayPaymentRequestId: booking.hitpay_payment_request_id ?? "",
      bookingId,
      amount: booking.net_collected ?? booking.total_price,
      currency: "SGD",
    });
    return { success: "Payment confirmed." };
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

    try {
      await callRpcWithFallbacks(
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
    } catch (error) {
      if (!isMissingRpcSignatureError(error, "mark_item_returned_by_renter")) {
        throw error;
      }

      await markReturnToListerDirect({
        supabase: auth.supabase,
        booking,
        userId: auth.user.id,
        notes,
        photoUrls,
      });
    }

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

    await autoTriggerPayout(booking.id);

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
      description: `Item condition: ${parsed.data.return_condition}.${notesText} Stock restored. Payout flow has been queued for processing.`,
      metadata: {
        return_condition: parsed.data.return_condition,
        payout_amount: booking.lister_payout,
      },
    });

    if (
      parsed.data.return_condition === "damaged" ||
      parsed.data.return_condition === "missing_parts"
    ) {
      await createNotification({
        userId: booking.renter_id,
        type: "return_condition_issue",
        title: "Return condition flagged",
        body: `Your returned item was marked as ${parsed.data.return_condition}.`,
        listingId: booking.listing_id,
        bookingId: booking.id,
        fromUserId: auth.user.id,
        actionUrl: `/dashboard/bookings/${booking.id}`,
      });
    }

    await Promise.all([
      createNotification({
        userId: booking.lister_id,
        type: "booking_completed",
        title: "Booking completed",
        body: "Booking completed! Please leave a review.",
        listingId: booking.listing_id,
        bookingId: booking.id,
        fromUserId: booking.renter_id,
        actionUrl: `/dashboard/bookings/${booking.id}`,
      }),
      createNotification({
        userId: booking.renter_id,
        type: "booking_completed",
        title: "Booking completed",
        body: "Booking completed! Please leave a review.",
        listingId: booking.listing_id,
        bookingId: booking.id,
        fromUserId: booking.lister_id,
        actionUrl: `/dashboard/bookings/${booking.id}`,
      }),
    ]);

    revalidateBookingViews();
    return { success: "Booking completed successfully." };
  } catch (error) {
    console.error("confirmReturnAndComplete failed:", error);
    return { error: "Something went wrong. Please try again." };
  }
}

export async function cancelBooking(
  bookingId: string,
  reason?: string,
): Promise<ActionResponse> {
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth) {
      return { error: "You must be signed in to cancel a booking." };
    }

    const booking = await getBookingRecord(auth.supabase, bookingId);
    const actorRole = getRoleForBooking(booking, auth.user.id);
    if (!actorRole) {
      return { error: "You are not allowed to cancel this booking." };
    }

    if (booking.status === "active" || booking.status === "returned") {
      return {
        error: "Cannot cancel. Please raise a dispute if there's an issue.",
      };
    }

    if (
      booking.status !== "pending" &&
      booking.status !== "awaiting_payment" &&
      booking.status !== "confirmed"
    ) {
      return { error: "This booking can no longer be cancelled." };
    }

    let stockRestored = booking.stock_restored;
    if ((booking.stock_reserved || booking.stock_deducted) && !booking.stock_restored) {
      await releaseStock(auth.supabase, booking, auth.user.id);
      stockRestored = true;
    }

    const cancelStatus: BookingStatus =
      actorRole === "renter" ? "cancelled_by_renter" : "cancelled_by_lister";
    const cancellationReason = normalizeText(reason) ?? "No reason provided.";
    const now = new Date().toISOString();

    const { error: updateError } = await auth.supabase
      .from("bookings")
      .update({
        status: cancelStatus,
        cancelled_at: now,
        cancelled_by: auth.user.id,
        cancellation_reason: cancellationReason,
        stock_restored: stockRestored,
      })
      .eq("id", booking.id);

    if (updateError) {
      return { error: updateError.message };
    }

    await addTimeline({
      bookingId: booking.id,
      status: cancelStatus,
      previousStatus: booking.status,
      actorId: auth.user.id,
      actorRole,
      title: "Booking cancelled",
      description: `${getActorDisplayName(actorRole === "renter" ? booking.renter : booking.lister, auth.user.email)} cancelled the booking. Reason: ${cancellationReason}`,
      metadata: {
        cancelled_from_status: booking.status,
        stock_released: stockRestored,
      },
    });

    const otherUserId = actorRole === "renter" ? booking.lister_id : booking.renter_id;
    await createNotification({
      userId: otherUserId,
      type: "booking_cancelled",
      title: "Booking cancelled",
      body: `The booking was cancelled. Reason: ${cancellationReason}`,
      listingId: booking.listing_id,
      bookingId: booking.id,
      fromUserId: auth.user.id,
      actionUrl: `/dashboard/bookings/${booking.id}`,
    });

    let successMessage = "Booking cancelled.";
    if (booking.paid_at) {
      const refundResult = await processCancellationRefund(booking.id, {
        cancelledBy: actorRole,
      });

      if ("error" in refundResult) {
        successMessage = `${successMessage} Refund requires attention: ${refundResult.error}`;
      } else {
        successMessage = `${successMessage} ${refundResult.message}`;
      }
    }

    revalidateBookingViews();
    return { success: successMessage };
  } catch (error) {
    console.error("cancelBooking failed:", error);
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

    await createNotification({
      userId: actorRole === "renter" ? booking.lister_id : booking.renter_id,
      type: "booking_disputed",
      title: "Dispute raised",
      body: disputeReason,
      listingId: booking.listing_id,
      bookingId: booking.id,
      fromUserId: auth.user.id,
      actionUrl: `/dashboard/bookings/${booking.id}`,
    });

    const admin = createAdminClient();
    const { data: admins } = await admin
      .from("profiles")
      .select("id")
      .eq("is_admin", true);

    await Promise.all(
      (admins ?? []).map((adminProfile) =>
        createNotification({
          userId: String((adminProfile as { id: string }).id),
          type: "booking_disputed",
          title: "Booking dispute requires review",
          body: `Booking ${booking.id} was disputed. Reason: ${disputeReason}`,
          listingId: booking.listing_id,
          bookingId: booking.id,
          fromUserId: auth.user.id,
          actionUrl: `/admin/bookings/${booking.id}`,
        }),
      ),
    );

    await holdPaymentForDispute(booking.id);

    revalidateBookingViews();
    return { success: "Dispute raised." };
  } catch (error) {
    console.error("raiseDispute failed:", error);
    return { error: "Something went wrong. Please try again." };
  }
}

export async function getIncomingRequests(
  userId: string,
  status?: BookingStatus,
): Promise<BookingWithDetails[]> {
  try {
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
    console.error("getIncomingRequests failed:", error);
    return [];
  }
}

export async function getMyRentals(
  userId: string,
  status?: BookingStatus,
): Promise<BookingWithDetails[]> {
  try {
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

export async function expireUnpaidBookings(): Promise<ActionResponse> {
  try {
    const admin = createAdminClient();
    await callRpcWithFallbacks(admin, "expire_unpaid_bookings", [{}]);
    revalidateBookingViews();
    return { success: "Expired unpaid bookings." };
  } catch (error) {
    console.error("expireUnpaidBookings failed:", error);
    return { error: "Could not expire unpaid bookings." };
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
