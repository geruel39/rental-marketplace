"use server";

import { revalidatePath } from "next/cache";
import { addHours, format, startOfDay } from "date-fns";

import { createPaymentForBooking } from "@/actions/hitpay";
import { createNotification } from "@/actions/notifications";
import { calculateNumUnits } from "@/lib/bookings";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  bookingRequestSchema,
  confirmReturnSchema,
  returnItemSchema,
} from "@/lib/validations";
import type {
  ActionResponse,
  Booking,
  BookingStatus,
  BookingTimeline,
  BookingTimelineWithActor,
  BookingWithDetails,
  Listing,
  PricingCalculation,
  Profile,
  TimelineActorRole,
} from "@/types";

const RENTER_SERVICE_FEE_RATE = 0.05;
const LISTER_SERVICE_FEE_RATE = 0.05;
const PAYMENT_EXPIRY_HOURS = 24;
const CANCELLABLE_STATUSES = new Set<BookingStatus>([
  "pending",
  "awaiting_payment",
  "confirmed",
]);
const COMPLETED_PAYMENT_STATUSES = new Set<BookingStatus>([
  "confirmed",
  "out_for_delivery",
  "active",
  "returned",
  "completed",
]);

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
type AcceptBookingOptions = {
  supabase: AnySupabaseClient;
  bookingId: string;
  actorId: string;
  actorRole: "lister";
};
type ConfirmPaymentOptions = {
  supabase: AnySupabaseClient;
  bookingId: string;
  paymentId?: string;
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

function formatDateTime(value: string | Date | null | undefined) {
  if (!value) {
    return "TBD";
  }

  return format(new Date(value), "PPP p");
}

function appendNote(existing: string | null | undefined, incoming?: string) {
  const next = normalizeText(incoming);

  if (!next) {
    return existing ?? null;
  }

  return existing ? `${existing}\n${next}` : next;
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

function calculatePricing(params: {
  listing: Listing;
  pricingPeriod: Booking["pricing_period"];
  quantity: number;
  startDate: string;
  endDate: string;
  deliveryFee: number;
}): PricingCalculation {
  const unitPrice = getUnitPrice(params.listing, params.pricingPeriod);

  if (typeof unitPrice !== "number") {
    throw new Error(
      `This listing does not support ${params.pricingPeriod} pricing`,
    );
  }

  const numUnits = calculateNumUnits(
    params.startDate,
    params.endDate,
    params.pricingPeriod,
  );
  const subtotal = roundMoney(unitPrice * numUnits * params.quantity);
  const serviceFeeRenter = roundMoney(subtotal * RENTER_SERVICE_FEE_RATE);
  const serviceFeeLister = roundMoney(subtotal * LISTER_SERVICE_FEE_RATE);
  const depositAmount = roundMoney(
    (params.listing.deposit_amount ?? 0) * params.quantity,
  );
  const totalPrice = roundMoney(
    subtotal + serviceFeeRenter + depositAmount + params.deliveryFee,
  );
  const listerPayout = roundMoney(subtotal - serviceFeeLister);

  return {
    subtotal,
    serviceFeeRenter,
    serviceFeeLister,
    depositAmount,
    deliveryFee: params.deliveryFee,
    totalPrice,
    listerPayout,
    numUnits,
    unitPrice,
  };
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

  return {
    supabase,
    user,
    profile: profile ?? null,
  };
}

async function callRpcWithFallbacks<T>(
  supabase: AnySupabaseClient,
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
        const parsed = extractRpcNumber(
          (first as Record<string, unknown>)[key],
        );

        if (parsed !== null) {
          return parsed;
        }
      }
    }
  }

  if (value && typeof value === "object") {
    for (const key of ["get_available_stock", "available_stock", "stock_available"]) {
      const parsed = extractRpcNumber((value as Record<string, unknown>)[key]);

      if (parsed !== null) {
        return parsed;
      }
    }
  }

  return null;
}

async function getAvailableStock(
  supabase: AnySupabaseClient,
  listingId: string,
  startDate: string,
  endDate: string,
  trackInventory = true,
) {
  if (!trackInventory) {
    return Number.MAX_SAFE_INTEGER;
  }

  const data = await callRpcWithFallbacks<unknown>(
    supabase,
    "get_available_stock",
    [
      {
        p_listing_id: listingId,
        p_start_date: startDate,
        p_end_date: endDate,
      },
      {
        listing_id: listingId,
        start_date: startDate,
        end_date: endDate,
      },
    ],
  );

  const available = extractRpcNumber(data);

  if (available === null) {
    throw new Error("Could not determine available stock");
  }

  return available;
}

async function reserveStock(
  supabase: AnySupabaseClient,
  booking: Pick<Booking, "id" | "listing_id" | "quantity">,
  userId: string,
) {
  const result = await callRpcWithFallbacks<boolean | null>(
    supabase,
    "reserve_stock",
    [
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
    ],
  );

  if (result === false) {
    throw new Error("Not enough stock available to reserve this booking");
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

function getPaymentExpiryTime() {
  return addHours(new Date(), PAYMENT_EXPIRY_HOURS);
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
}) {
  try {
    const admin = createAdminClient();

    await callRpcWithFallbacks(admin, "add_booking_timeline", [
      {
        p_booking_id: params.bookingId,
        p_status: params.status,
        p_previous_status: params.previousStatus ?? null,
        p_actor_id: params.actorId ?? null,
        p_actor_role: params.actorRole,
        p_title: params.title,
        p_description: params.description ?? null,
        p_metadata: params.metadata ?? {},
      },
      {
        booking_id: params.bookingId,
        status: params.status,
        previous_status: params.previousStatus ?? null,
        actor_id: params.actorId ?? null,
        actor_role: params.actorRole,
        title: params.title,
        description: params.description ?? null,
        metadata: params.metadata ?? {},
      },
    ]);
  } catch (error) {
    console.error("addTimeline failed:", error);
  }
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

  return {
    ...data,
    listing,
    renter,
    lister,
  };
}

async function getListingRecord(
  supabase: AnySupabaseClient,
  listingId: string,
) {
  const { data, error } = await supabase
    .from("listings")
    .select("*, owner:profiles!listings_owner_id_fkey(*)")
    .eq("id", listingId)
    .eq("status", "active")
    .maybeSingle<ListingRecord>();

  if (error || !data) {
    throw new Error("Listing not found");
  }

  const owner = unwrapRelation(data.owner);

  if (!owner) {
    throw new Error("Listing owner not found");
  }

  return {
    ...data,
    owner,
  };
}

function revalidateBookingViews() {
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/requests");
  revalidatePath("/dashboard/my-rentals");
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

function getRoleForBooking(
  booking: Pick<Booking, "renter_id" | "lister_id">,
  userId: string,
): "renter" | "lister" | null {
  if (booking.renter_id === userId) {
    return "renter";
  }

  if (booking.lister_id === userId) {
    return "lister";
  }

  return null;
}

function getScheduledFulfillmentDate(booking: Booking) {
  return booking.fulfillment_type === "delivery"
    ? booking.delivery_scheduled_at
    : booking.pickup_scheduled_at;
}

async function acceptBookingRequestInternal(
  options: AcceptBookingOptions,
): Promise<BookingActionResponse> {
  const booking = await getBookingRecord(options.supabase, options.bookingId);

  if (booking.status !== "pending") {
    return { error: "Only pending bookings can be accepted" };
  }

  const availableStock = await getAvailableStock(
    options.supabase,
    booking.listing_id,
    booking.start_date,
    booking.end_date,
    booking.listing.track_inventory,
  );

  if (availableStock < booking.quantity) {
    return { error: "Insufficient stock. Cannot accept." };
  }

  await reserveStock(options.supabase, booking, options.actorId);

  const paymentExpiresAt = getPaymentExpiryTime().toISOString();
  const { error: updateError } = await options.supabase
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
    actorId: options.actorId,
    actorRole: options.actorRole,
    title: "Booking accepted by lister",
    description: `Stock has been reserved. Waiting for renter to complete payment. Payment must be completed by ${formatDateTime(paymentExpiresAt)}.`,
    metadata: {
      stock_reserved: true,
      payment_expires_at: paymentExpiresAt,
    },
  });

  const paymentResult = await createPaymentForBooking(booking.id);

  if ("error" in paymentResult) {
    return paymentResult;
  }

  await createNotification({
    userId: booking.renter_id,
    type: "booking_accepted",
    title: "Your booking has been accepted",
    body: `Your booking has been accepted! Please complete payment by ${formatDateTime(paymentExpiresAt)}.${paymentResult.paymentUrl ? " Use the payment link to continue." : ""}`,
    listingId: booking.listing_id,
    bookingId: booking.id,
    fromUserId: booking.lister_id,
    actionUrl: paymentResult.paymentUrl ?? "/dashboard/my-rentals",
  });

  revalidateBookingViews();

  return {
    success: "Booking accepted. Payment link sent to renter.",
    paymentUrl: paymentResult.paymentUrl,
  };
}

async function confirmPaymentInternal(
  options: ConfirmPaymentOptions,
): Promise<ActionResponse> {
  const booking = await getBookingRecord(options.supabase, options.bookingId);

  if (booking.status !== "awaiting_payment") {
    if (
      booking.hitpay_payment_status === "completed" &&
      COMPLETED_PAYMENT_STATUSES.has(booking.status)
    ) {
      return { success: "Payment already confirmed." };
    }

    return { error: "Only bookings awaiting payment can be confirmed." };
  }

  const paidAt = new Date().toISOString();
  const { error: updateError } = await options.supabase
    .from("bookings")
    .update({
      status: "confirmed",
      stock_deducted: true,
      paid_at: paidAt,
      hitpay_payment_id: options.paymentId ?? booking.hitpay_payment_id,
      hitpay_payment_status: "completed",
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
    title: "Payment received",
    description: `Payment of ${booking.total_price} has been confirmed. Item is being prepared.`,
    metadata: {
      payment_id: options.paymentId ?? null,
      amount: booking.total_price,
    },
  });

  const scheduledDate = formatDateTime(getScheduledFulfillmentDate(booking));
  const handoffText =
    booking.fulfillment_type === "delivery"
      ? `delivered on ${scheduledDate}`
      : `ready for pickup on ${scheduledDate}`;

  await Promise.all([
    createNotification({
      userId: booking.lister_id,
      type: "payment_received",
      title: "Payment received for booking",
      body: `Payment received for booking. Please prepare the item for ${booking.fulfillment_type}.`,
      listingId: booking.listing_id,
      bookingId: booking.id,
      fromUserId: booking.renter_id,
      actionUrl: "/dashboard/requests",
    }),
    createNotification({
      userId: booking.renter_id,
      type: "payment_confirmed",
      title: "Payment confirmed",
      body: `Payment confirmed! Your item will be ${handoffText}.`,
      listingId: booking.listing_id,
      bookingId: booking.id,
      fromUserId: booking.lister_id,
      actionUrl: "/dashboard/my-rentals",
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
      start_date: formData.get("start_date"),
      end_date: formData.get("end_date"),
      quantity: formData.get("quantity"),
      pricing_period: formData.get("pricing_period"),
      fulfillment_type: formData.get("fulfillment_type"),
      delivery_address: normalizeText(formData.get("delivery_address")?.toString()),
      delivery_city: normalizeText(formData.get("delivery_city")?.toString()),
      delivery_state: normalizeText(formData.get("delivery_state")?.toString()),
      delivery_postal_code: normalizeText(
        formData.get("delivery_postal_code")?.toString(),
      ),
      delivery_notes: normalizeText(formData.get("delivery_notes")?.toString()),
      delivery_scheduled_at: normalizeText(
        formData.get("delivery_scheduled_at")?.toString(),
      ),
      pickup_scheduled_at: normalizeText(
        formData.get("pickup_scheduled_at")?.toString(),
      ),
      pickup_notes: normalizeText(formData.get("pickup_notes")?.toString()),
      message: normalizeText(formData.get("message")?.toString()),
    });

    if (!parsed.success) {
      return {
        error: parsed.error.issues[0]?.message ?? "Invalid booking request.",
      };
    }

    const startDate = toDateOnlyString(parsed.data.start_date);
    const endDate = toDateOnlyString(parsed.data.end_date);
    const today = toDateOnlyString(startOfDay(new Date()));

    if (startDate < today) {
      return { error: "Start date must be today or later." };
    }

    if (endDate <= startDate) {
      return { error: "End date must be after start date." };
    }

    const listing = await getListingRecord(auth.supabase, parsed.data.listing_id);

    if (listing.owner_id === auth.user.id) {
      return { error: "You cannot book your own listing." };
    }

    if (
      parsed.data.fulfillment_type === "delivery" &&
      !listing.delivery_available
    ) {
      return { error: "This listing does not support delivery." };
    }

    const availableStock = await getAvailableStock(
      auth.supabase,
      listing.id,
      startDate,
      endDate,
      listing.track_inventory,
    );

    if (availableStock < parsed.data.quantity) {
      return { error: "Not enough stock" };
    }

    const deliveryFee =
      parsed.data.fulfillment_type === "delivery"
        ? roundMoney(listing.delivery_fee ?? 0)
        : 0;
    const deliveryLatitude = Number(formData.get("delivery_latitude"));
    const deliveryLongitude = Number(formData.get("delivery_longitude"));
    const pricing = calculatePricing({
      listing,
      pricingPeriod: parsed.data.pricing_period,
      quantity: parsed.data.quantity,
      startDate,
      endDate,
      deliveryFee,
    });

    const { data: insertedBooking, error: insertError } = await auth.supabase
      .from("bookings")
      .insert({
        listing_id: listing.id,
        renter_id: auth.user.id,
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
        fulfillment_type: parsed.data.fulfillment_type,
        delivery_address:
          parsed.data.fulfillment_type === "delivery"
            ? parsed.data.delivery_address ?? null
            : null,
        delivery_city:
          parsed.data.fulfillment_type === "delivery"
            ? parsed.data.delivery_city ?? null
            : null,
        delivery_state:
          parsed.data.fulfillment_type === "delivery"
            ? parsed.data.delivery_state ?? null
            : null,
        delivery_postal_code:
          parsed.data.fulfillment_type === "delivery"
            ? parsed.data.delivery_postal_code ?? null
            : null,
        delivery_latitude:
          parsed.data.fulfillment_type === "delivery" &&
          Number.isFinite(deliveryLatitude)
            ? deliveryLatitude
            : null,
        delivery_longitude:
          parsed.data.fulfillment_type === "delivery" &&
          Number.isFinite(deliveryLongitude)
            ? deliveryLongitude
            : null,
        delivery_scheduled_at:
          parsed.data.fulfillment_type === "delivery"
            ? parsed.data.delivery_scheduled_at ?? null
            : null,
        delivery_notes:
          parsed.data.fulfillment_type === "delivery"
            ? parsed.data.delivery_notes ?? null
            : null,
        pickup_scheduled_at:
          parsed.data.fulfillment_type === "pickup"
            ? parsed.data.pickup_scheduled_at ?? null
            : null,
        pickup_notes:
          parsed.data.fulfillment_type === "pickup"
            ? parsed.data.pickup_notes ?? null
            : null,
        message: parsed.data.message ?? null,
        stock_deducted: false,
        stock_reserved: false,
        stock_restored: false,
      })
      .select("*")
      .single<Booking>();

    if (insertError || !insertedBooking) {
      return { error: insertError?.message ?? "Could not create booking." };
    }

    const actorName = getActorDisplayName(
      auth.profile,
      auth.user.email ?? "Renter",
    );

    await addTimeline({
      bookingId: insertedBooking.id,
      status: "pending",
      actorId: auth.user.id,
      actorRole: "renter",
      title: "Booking request submitted",
      description: `${actorName} requested to book ${listing.title} for ${formatDateTime(startDate)} to ${formatDateTime(endDate)}. Fulfillment: ${parsed.data.fulfillment_type}.`,
      metadata: {
        quantity: parsed.data.quantity,
        fulfillment_type: parsed.data.fulfillment_type,
        total_price: pricing.totalPrice,
      },
    });

    await createNotification({
      userId: listing.owner_id,
      type: "booking_request",
      title: `New booking request for ${listing.title}`,
      body: `${actorName} submitted a booking request for ${listing.title}.`,
      listingId: listing.id,
      bookingId: insertedBooking.id,
      fromUserId: auth.user.id,
      actionUrl: "/dashboard/requests",
    });

    let paymentUrl: string | null = null;

    if (listing.instant_book && availableStock >= parsed.data.quantity) {
      const accepted = await acceptBookingRequestInternal({
        supabase: createAdminClient(),
        bookingId: insertedBooking.id,
        actorId: listing.owner_id,
        actorRole: "lister",
      });

      if (accepted.error) {
        return accepted;
      }

      paymentUrl = accepted.paymentUrl ?? null;
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
    const auth = await requireAuthenticatedUser();

    if (!auth) {
      return { error: "You must be signed in to accept a booking." };
    }

    const booking = await getBookingRecord(auth.supabase, bookingId);

    if (booking.lister_id !== auth.user.id) {
      return { error: "You are not allowed to accept this booking." };
    }

    return await acceptBookingRequestInternal({
      supabase: auth.supabase,
      bookingId,
      actorId: auth.user.id,
      actorRole: "lister",
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
      return { error: "You are not allowed to decline this booking." };
    }

    if (booking.status !== "pending") {
      return { error: "Only pending bookings can be declined." };
    }

    const declineReason =
      normalizeText(reason) ?? "Lister declined the booking request.";
    const now = new Date().toISOString();
    const { error: updateError } = await auth.supabase
      .from("bookings")
      .update({
        status: "cancelled_by_lister",
        cancelled_at: now,
        cancelled_by: auth.user.id,
        cancellation_reason: declineReason,
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
      title: "Booking declined by lister",
      description: declineReason,
    });

    await createNotification({
      userId: booking.renter_id,
      type: "booking_declined",
      title: "Booking request declined",
      body: declineReason,
      listingId: booking.listing_id,
      bookingId: booking.id,
      fromUserId: auth.user.id,
      actionUrl: "/dashboard/my-rentals",
    });

    revalidateBookingViews();

    return { success: "Booking request declined." };
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
    return await confirmPaymentInternal({
      supabase: createAdminClient(),
      bookingId,
      paymentId,
    });
  } catch (error) {
    console.error("confirmPaymentFromWebhook failed:", error);
    return { error: "Something went wrong. Please try again." };
  }
}

export async function markOutForDelivery(
  bookingId: string,
  notes?: string,
): Promise<ActionResponse> {
  try {
    const auth = await requireAuthenticatedUser();

    if (!auth) {
      return { error: "You must be signed in to update delivery status." };
    }

    const booking = await getBookingRecord(auth.supabase, bookingId);

    if (booking.lister_id !== auth.user.id) {
      return { error: "You are not allowed to update this booking." };
    }

    if (booking.status !== "confirmed") {
      return { error: "Only confirmed bookings can be marked out for delivery." };
    }

    if (booking.fulfillment_type !== "delivery") {
      return { error: "This booking is not a delivery order." };
    }

    const { error: updateError } = await auth.supabase
      .from("bookings")
      .update({
        status: "out_for_delivery",
        delivery_notes: appendNote(booking.delivery_notes, notes),
      })
      .eq("id", booking.id);

    if (updateError) {
      return { error: updateError.message };
    }

    await addTimeline({
      bookingId: booking.id,
      status: "out_for_delivery",
      previousStatus: "confirmed",
      actorId: auth.user.id,
      actorRole: "lister",
      title: "Item out for delivery",
      description: `Lister has dispatched the item for delivery to ${booking.delivery_address ?? "the delivery address"}, ${booking.delivery_city ?? ""}.`.trim(),
      metadata: {
        delivery_address: booking.delivery_address ?? null,
      },
    });

    await createNotification({
      userId: booking.renter_id,
      type: "booking_out_for_delivery",
      title: "Your item is on its way",
      body: "Your item is on its way!",
      listingId: booking.listing_id,
      bookingId: booking.id,
      fromUserId: auth.user.id,
      actionUrl: "/dashboard/my-rentals",
    });

    revalidateBookingViews();

    return { success: "Booking marked out for delivery." };
  } catch (error) {
    console.error("markOutForDelivery failed:", error);
    return { error: "Something went wrong. Please try again." };
  }
}

export async function markItemHandedOver(
  bookingId: string,
  notes?: string,
): Promise<ActionResponse> {
  try {
    const auth = await requireAuthenticatedUser();

    if (!auth) {
      return { error: "You must be signed in to hand over the item." };
    }

    const booking = await getBookingRecord(auth.supabase, bookingId);

    if (booking.lister_id !== auth.user.id) {
      return { error: "You are not allowed to update this booking." };
    }

    if (booking.fulfillment_type === "delivery") {
      if (booking.status !== "out_for_delivery") {
        return { error: "Delivery bookings must be out for delivery first." };
      }

      const deliveredAt = new Date().toISOString();
      const { error: updateError } = await auth.supabase
        .from("bookings")
        .update({
          status: "active",
          delivered_at: deliveredAt,
          delivery_notes: appendNote(booking.delivery_notes, notes),
        })
        .eq("id", booking.id);

      if (updateError) {
        return { error: updateError.message };
      }

      await addTimeline({
        bookingId: booking.id,
        status: "active",
        previousStatus: "out_for_delivery",
        actorId: auth.user.id,
        actorRole: "lister",
        title: "Item delivered",
        description: "Item has been delivered to the renter.",
      });
    } else {
      if (booking.status !== "confirmed") {
        return { error: "Pickup bookings must be confirmed before handover." };
      }

      const pickedUpAt = new Date().toISOString();
      const { error: updateError } = await auth.supabase
        .from("bookings")
        .update({
          status: "active",
          picked_up_at: pickedUpAt,
          pickup_notes: appendNote(booking.pickup_notes, notes),
        })
        .eq("id", booking.id);

      if (updateError) {
        return { error: updateError.message };
      }

      await addTimeline({
        bookingId: booking.id,
        status: "active",
        previousStatus: "confirmed",
        actorId: auth.user.id,
        actorRole: "lister",
        title: "Item picked up",
        description: "Renter has picked up the item.",
      });
    }

    await createNotification({
      userId: booking.renter_id,
      type: "rental_started",
      title: "Rental period has started",
      body: `Rental period has started! Return date: ${formatDateTime(booking.end_date)}.`,
      listingId: booking.listing_id,
      bookingId: booking.id,
      fromUserId: auth.user.id,
      actionUrl: "/dashboard/my-rentals",
    });

    revalidateBookingViews();

    return { success: "Item handover recorded." };
  } catch (error) {
    console.error("markItemHandedOver failed:", error);
    return { error: "Something went wrong. Please try again." };
  }
}

export async function initiateReturn(
  prevState: ActionResponse | FormData | null,
  formDataArg?: FormData,
): Promise<ActionResponse> {
  try {
    const auth = await requireAuthenticatedUser();

    if (!auth) {
      return { error: "You must be signed in to schedule a return." };
    }

    const formData = getFormData(prevState, formDataArg);

    if (!formData) {
      return { error: "Missing return form data." };
    }

    const parsed = returnItemSchema.safeParse({
      booking_id: formData.get("booking_id"),
      return_method: formData.get("return_method"),
      return_scheduled_at: formData.get("return_scheduled_at"),
      return_notes: normalizeText(formData.get("return_notes")?.toString()),
    });

    if (!parsed.success) {
      return {
        error: parsed.error.issues[0]?.message ?? "Invalid return request.",
      };
    }

    const booking = await getBookingRecord(auth.supabase, parsed.data.booking_id);
    const actorRole = getRoleForBooking(booking, auth.user.id);

    if (!actorRole) {
      return { error: "You are not allowed to update this booking." };
    }

    if (booking.status !== "active") {
      return { error: "Only active bookings can initiate a return." };
    }

    const { error: updateError } = await auth.supabase
      .from("bookings")
      .update({
        return_method: parsed.data.return_method,
        return_scheduled_at: parsed.data.return_scheduled_at,
        return_notes: parsed.data.return_notes ?? null,
      })
      .eq("id", booking.id);

    if (updateError) {
      return { error: updateError.message };
    }

    await addTimeline({
      bookingId: booking.id,
      status: "active",
      previousStatus: "active",
      actorId: auth.user.id,
      actorRole,
      title: "Return initiated",
      description: `Return scheduled via ${parsed.data.return_method} on ${formatDateTime(parsed.data.return_scheduled_at)}.${parsed.data.return_notes ? ` ${parsed.data.return_notes}` : ""}`,
      metadata: {
        return_method: parsed.data.return_method,
        return_scheduled_at: parsed.data.return_scheduled_at,
      },
    });

    const recipientId =
      actorRole === "renter" ? booking.lister_id : booking.renter_id;

    await createNotification({
      userId: recipientId,
      type: "return_scheduled",
      title: "Return scheduled",
      body: `Return has been scheduled for ${formatDateTime(parsed.data.return_scheduled_at)}.`,
      listingId: booking.listing_id,
      bookingId: booking.id,
      fromUserId: auth.user.id,
      actionUrl:
        actorRole === "renter"
          ? "/dashboard/requests"
          : "/dashboard/my-rentals",
    });

    revalidateBookingViews();

    return { success: "Return scheduled." };
  } catch (error) {
    console.error("initiateReturn failed:", error);
    return { error: "Something went wrong. Please try again." };
  }
}

export async function markItemReturned(
  bookingId: string,
): Promise<ActionResponse> {
  try {
    const auth = await requireAuthenticatedUser();

    if (!auth) {
      return { error: "You must be signed in to confirm the return." };
    }

    const booking = await getBookingRecord(auth.supabase, bookingId);

    if (booking.lister_id !== auth.user.id) {
      return { error: "You are not allowed to update this booking." };
    }

    if (booking.status !== "active") {
      return { error: "Only active bookings can be marked returned." };
    }

    const returnedAt = new Date().toISOString();
    const { error: updateError } = await auth.supabase
      .from("bookings")
      .update({
        status: "returned",
        returned_at: returnedAt,
      })
      .eq("id", booking.id);

    if (updateError) {
      return { error: updateError.message };
    }

    await addTimeline({
      bookingId: booking.id,
      status: "returned",
      previousStatus: "active",
      actorId: auth.user.id,
      actorRole: "lister",
      title: "Item returned",
      description:
        "Lister has received the returned item. Awaiting condition inspection.",
    });

    await createNotification({
      userId: booking.renter_id,
      type: "item_returned",
      title: "Returned item received",
      body: "Your returned item has been received. The lister will inspect it shortly.",
      listingId: booking.listing_id,
      bookingId: booking.id,
      fromUserId: auth.user.id,
      actionUrl: "/dashboard/my-rentals",
    });

    revalidateBookingViews();

    return { success: "Item marked as returned." };
  } catch (error) {
    console.error("markItemReturned failed:", error);
    return { error: "Something went wrong. Please try again." };
  }
}

export async function confirmReturnAndComplete(
  prevState: ActionResponse | FormData | null,
  formDataArg?: FormData,
): Promise<ActionResponse> {
  try {
    const auth = await requireAuthenticatedUser();

    if (!auth) {
      return { error: "You must be signed in to complete the booking." };
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
      return { error: "You are not allowed to complete this booking." };
    }

    if (booking.status !== "returned") {
      return { error: "Only returned bookings can be completed." };
    }

    const { error: bookingUpdateError } = await auth.supabase
      .from("bookings")
      .update({
        return_condition: parsed.data.return_condition,
        return_condition_notes: parsed.data.return_condition_notes ?? null,
        status: "completed",
      })
      .eq("id", booking.id);

    if (bookingUpdateError) {
      return { error: bookingUpdateError.message };
    }

    await returnStock(auth.supabase, booking, auth.user.id);

    const { error: stockUpdateError } = await auth.supabase
      .from("bookings")
      .update({
        stock_restored: true,
      })
      .eq("id", booking.id);

    if (stockUpdateError) {
      return { error: stockUpdateError.message };
    }

    const { error: payoutError } = await auth.supabase.from("payouts").insert({
      lister_id: booking.lister_id,
      booking_id: booking.id,
      amount: booking.lister_payout,
      currency: "SGD",
      status: "pending",
      reference_number: booking.id,
      notes: "Auto-created after booking completion.",
    });

    if (payoutError) {
      return { error: payoutError.message };
    }

    await addTimeline({
      bookingId: booking.id,
      status: "completed",
      previousStatus: "returned",
      actorId: auth.user.id,
      actorRole: "lister",
      title: "Rental completed",
      description: `Item condition: ${parsed.data.return_condition}. ${parsed.data.return_condition_notes ?? "No issues reported."} Stock has been restored. Payout is being processed.`,
      metadata: {
        return_condition: parsed.data.return_condition,
        payout_amount: booking.lister_payout,
      },
    });

    if (
      parsed.data.return_condition === "damaged" ||
      parsed.data.return_condition === "missing_parts"
    ) {
      await addTimeline({
        bookingId: booking.id,
        status: "completed",
        previousStatus: "returned",
        actorId: auth.user.id,
        actorRole: "lister",
        title: "Condition issue reported",
        description: `Lister reported: ${parsed.data.return_condition}. Notes: ${parsed.data.return_condition_notes ?? "No additional notes."}. Deposit may be affected.`,
        metadata: {
          return_condition: parsed.data.return_condition,
        },
      });

      await createNotification({
        userId: booking.renter_id,
        type: "return_condition_issue",
        title: "Condition issue reported",
        body: `Your returned item was marked as ${parsed.data.return_condition}. The lister may claim part of the deposit.`,
        listingId: booking.listing_id,
        bookingId: booking.id,
        fromUserId: auth.user.id,
        actionUrl: "/dashboard/my-rentals",
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
        actionUrl: "/dashboard/requests",
      }),
      createNotification({
        userId: booking.renter_id,
        type: "booking_completed",
        title: "Booking completed",
        body: "Booking completed! Please leave a review.",
        listingId: booking.listing_id,
        bookingId: booking.id,
        fromUserId: booking.lister_id,
        actionUrl: "/dashboard/my-rentals",
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

    if (!CANCELLABLE_STATUSES.has(booking.status)) {
      if (
        booking.status === "active" ||
        booking.status === "out_for_delivery"
      ) {
        return { error: "Active bookings must use the dispute flow instead." };
      }

      return { error: "This booking can no longer be cancelled." };
    }

    let stockReleased = false;

    if (booking.stock_reserved && !booking.stock_restored) {
      await releaseStock(auth.supabase, booking, auth.user.id);
      stockReleased = true;
    }

    const cancelStatus =
      actorRole === "renter" ? "cancelled_by_renter" : "cancelled_by_lister";
    const actorName = getActorDisplayName(
      actorRole === "renter" ? booking.renter : booking.lister,
      auth.user.email,
    );
    const cancellationReason = normalizeText(reason) ?? "No reason provided.";
    const now = new Date().toISOString();
    const { error: updateError } = await auth.supabase
      .from("bookings")
      .update({
        status: cancelStatus,
        cancelled_at: now,
        cancelled_by: auth.user.id,
        cancellation_reason: cancellationReason,
        stock_restored: stockReleased ? true : booking.stock_restored,
      })
      .eq("id", booking.id);

    if (updateError) {
      return { error: updateError.message };
    }

    const stockMessage = stockReleased
      ? " Reserved stock was released."
      : "";

    await addTimeline({
      bookingId: booking.id,
      status: cancelStatus,
      previousStatus: booking.status,
      actorId: auth.user.id,
      actorRole,
      title: "Booking cancelled",
      description: `${actorName} cancelled the booking. Reason: ${cancellationReason}.${stockMessage}`,
      metadata: {
        cancelled_by: actorRole,
        stock_released: stockReleased,
      },
    });

    await createNotification({
      userId: actorRole === "renter" ? booking.lister_id : booking.renter_id,
      type: "booking_cancelled",
      title: "Booking cancelled",
      body: `${actorName} cancelled the booking. Reason: ${cancellationReason}.`,
      listingId: booking.listing_id,
      bookingId: booking.id,
      fromUserId: auth.user.id,
      actionUrl:
        actorRole === "renter"
          ? "/dashboard/requests"
          : "/dashboard/my-rentals",
    });

    revalidateBookingViews();

    return { success: "Booking cancelled." };
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

    const actorProfile = actorRole === "renter" ? booking.renter : booking.lister;
    const actorName = getActorDisplayName(actorProfile, auth.user.email);
    const appendedNotes = booking.admin_notes
      ? `${booking.admin_notes}\n[Dispute] ${actorName}: ${disputeReason}`
      : `[Dispute] ${actorName}: ${disputeReason}`;
    const previousStatus = booking.status;
    const { error: updateError } = await auth.supabase
      .from("bookings")
      .update({
        status: "disputed",
        admin_notes: appendedNotes,
      })
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
      description: `${actorName} raised a dispute. Reason: ${disputeReason}`,
    });

    await createNotification({
      userId: actorRole === "renter" ? booking.lister_id : booking.renter_id,
      type: "booking_disputed",
      title: "Dispute raised",
      body: `${actorName} raised a dispute. Reason: ${disputeReason}`,
      listingId: booking.listing_id,
      bookingId: booking.id,
      fromUserId: auth.user.id,
      actionUrl:
        actorRole === "renter"
          ? "/dashboard/requests"
          : "/dashboard/my-rentals",
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
          body: `${actorName} raised a dispute on booking ${booking.id}. Reason: ${disputeReason}`,
          listingId: booking.listing_id,
          bookingId: booking.id,
          fromUserId: auth.user.id,
          actionUrl: `/admin/bookings/${booking.id}`,
        }),
      ),
    );

    revalidateBookingViews();

    return { success: "Dispute raised." };
  } catch (error) {
    console.error("raiseDispute failed:", error);
    return { error: "Something went wrong. Please try again." };
  }
}

export async function completeBooking(
  bookingId: string,
): Promise<ActionResponse> {
  try {
    const auth = await requireAuthenticatedUser();

    if (!auth) {
      return { error: "You must be signed in to update this booking." };
    }

    const booking = await getBookingRecord(auth.supabase, bookingId);

    if (booking.lister_id !== auth.user.id) {
      return { error: "You are not allowed to update this booking." };
    }

    if (
      booking.status === "confirmed" ||
      booking.status === "out_for_delivery"
    ) {
      return await markItemHandedOver(bookingId);
    }

    if (booking.status === "active") {
      return await markItemReturned(bookingId);
    }

    if (booking.status === "returned") {
      const completionForm = new FormData();
      completionForm.set("booking_id", bookingId);
      completionForm.set("return_condition", "good");
      completionForm.set(
        "return_condition_notes",
        "Completed using the legacy one-click action.",
      );
      return await confirmReturnAndComplete(null, completionForm);
    }

    return { error: "This booking cannot be completed from its current state." };
  } catch (error) {
    console.error("completeBooking failed:", error);
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
      const listing = unwrapRelation((booking as BookingRecord).listing);
      const renter = unwrapRelation((booking as BookingRecord).renter);
      const lister = unwrapRelation((booking as BookingRecord).lister);

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
      const listing = unwrapRelation((booking as BookingRecord).listing);
      const renter = unwrapRelation((booking as BookingRecord).renter);
      const lister = unwrapRelation((booking as BookingRecord).lister);

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
