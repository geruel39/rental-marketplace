"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

import { createNotification } from "@/actions/notifications";
import { getAppUrl, getHitPayApiUrl } from "@/lib/env";
import {
  notifyDisputeResolved,
  notifyPaymentConfirmed,
  notifyPayoutCompleted,
  notifyPayoutFailed,
  notifyRefundInitiated,
} from "@/lib/notifications";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type {
  ActionResponse,
  AdminTargetType,
  Booking,
  BookingStatus,
  CancellationRefundCalculation,
  DisputeResolution,
  DisputeResolutionType,
  FeeConfig,
  PaginatedResponse,
  Payout,
  PayoutTrigger,
  PlatformFees,
  Profile,
  Refund,
  RefundReason,
  TimelineActorRole,
  Transaction,
  TransactionWithDetails,
} from "@/types";

type AdminClient = ReturnType<typeof createAdminClient>;
type UserClient = Awaited<ReturnType<typeof createClient>>;
type AnyClient = AdminClient | UserClient;
type MaybeArray<T> = T | T[] | null;
type TransactionStatus = Transaction["status"];

type BookingWithRelations = Booking & {
  listing: { id: string; title: string; cancellation_policy?: string | null };
  renter: Profile;
  lister: Profile;
};

type PayoutWithRelations = Payout & {
  lister: Profile;
  booking: Booking;
};

type CreateTransactionParams = {
  bookingId?: string | null;
  renterId: string;
  listerId: string;
  eventType: Transaction["event_type"];
  grossAmount: number;
  hitpayFee: number;
  platformFee: number;
  netAmount: number;
  currency: string;
  hitpayPaymentRequestId?: string | null;
  hitpayPaymentId?: string | null;
  hitpayRefundId?: string | null;
  hitpayTransferId?: string | null;
  externalReference?: string | null;
  externalNotes?: string | null;
  status?: TransactionStatus;
  failureReason?: string | null;
  idempotencyKey: string;
  triggeredBy?: string | null;
  triggeredByRole?: Transaction["triggered_by_role"];
  metadata?: Record<string, unknown>;
  processedAt?: string | null;
};

let feeConfigCache:
  | {
      value: PlatformFees;
      fetchedAt: number;
    }
  | null = null;

const FIVE_MINUTES_MS = 5 * 60 * 1000;

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function isHitPayExpiredRequestError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /HITPAY_REQUEST_EXPIRED|payment request.*expired|expired request|already expired/i.test(
    message,
  );
}

function formatMoney(value: number, currency = "SGD") {
  return new Intl.NumberFormat("en-SG", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function unwrapRelation<T>(value: MaybeArray<T>): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

function normalizeBoolConfig(value: number) {
  return value >= 1;
}

function getDisplayName(profile: Pick<Profile, "display_name" | "full_name" | "email">) {
  return profile.display_name || profile.full_name || profile.email;
}

function revalidatePaymentViews() {
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/bookings");
  revalidatePath("/dashboard/earnings");
  revalidatePath("/dashboard/my-rentals");
  revalidatePath("/dashboard/requests");
  revalidatePath("/dashboard/settings/payments");
  revalidatePath("/admin");
  revalidatePath("/admin/bookings");
  revalidatePath("/admin/payouts");
}

async function getCurrentUser() {
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

async function requireAdminUser() {
  const auth = await getCurrentUser();
  if (!auth?.profile?.is_admin) {
    throw new Error("Unauthorized");
  }

  return auth;
}

async function getAdmins() {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("profiles")
    .select("id")
    .eq("is_admin", true);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as Array<Pick<Profile, "id">>;
}

async function notifyAdmins(params: {
  type?: string;
  title: string;
  body: string;
  bookingId?: string;
  fromUserId?: string;
  actionUrl?: string;
}) {
  try {
    const admins = await getAdmins();
    await Promise.all(
      admins.map((adminProfile) =>
        createNotification({
          userId: adminProfile.id,
          type: params.type ?? "admin_alert",
          title: params.title,
          body: params.body,
          bookingId: params.bookingId,
          fromUserId: params.fromUserId,
          actionUrl: params.actionUrl,
        }),
      ),
    );
  } catch (error) {
    console.error("notifyAdmins failed:", error);
  }
}

async function getRequestIp() {
  try {
    const headerStore = await headers();
    const forwardedFor = headerStore.get("x-forwarded-for");

    if (forwardedFor) {
      return forwardedFor.split(",")[0]?.trim() ?? null;
    }

    return (
      headerStore.get("x-real-ip") ??
      headerStore.get("cf-connecting-ip") ??
      null
    );
  } catch {
    return null;
  }
}

async function logAdminAction(params: {
  adminId: string;
  action: string;
  targetType: AdminTargetType;
  targetId: string;
  details?: Record<string, unknown>;
}) {
  try {
    const admin = createAdminClient();
    await admin.from("admin_audit_log").insert({
      admin_id: params.adminId,
      action: params.action,
      target_type: params.targetType,
      target_id: params.targetId,
      details: params.details ?? {},
      ip_address: await getRequestIp(),
    });
  } catch (error) {
    console.error("logAdminAction failed:", error);
  }
}

async function addBookingTimeline(params: {
  bookingId: string;
  status: BookingStatus;
  previousStatus?: BookingStatus;
  actorId?: string | null;
  actorRole: TimelineActorRole;
  title: string;
  description?: string;
  metadata?: Record<string, unknown>;
}) {
  const admin = createAdminClient();
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

  const rpcAttempts = [
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
  ];

  for (const args of rpcAttempts) {
    const { error } = await admin.rpc("add_booking_timeline", args);
    if (!error) {
      return;
    }
  }

  const { error } = await admin.from("booking_timeline").insert(payload);
  if (error) {
    console.error("addBookingTimeline failed:", error);
  }
}

async function getBookingWithRelations(
  client: AnyClient,
  bookingId: string,
): Promise<BookingWithRelations> {
  const { data, error } = await client
    .from("bookings")
    .select(
      `
        *,
        listing:listings!bookings_listing_id_fkey(id, title, cancellation_policy),
        renter:profiles!bookings_renter_id_fkey(*),
        lister:profiles!bookings_lister_id_fkey(*)
      `,
    )
    .eq("id", bookingId)
    .maybeSingle<BookingWithRelations>();

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

async function getPayoutWithRelations(
  client: AnyClient,
  payoutId: string,
): Promise<PayoutWithRelations> {
  const { data, error } = await client
    .from("payouts")
    .select(
      `
        *,
        lister:profiles!payouts_lister_id_fkey(*),
        booking:bookings!payouts_booking_id_fkey(*)
      `,
    )
    .eq("id", payoutId)
    .maybeSingle<PayoutWithRelations>();

  if (error || !data) {
    throw new Error("Payout not found");
  }

  const lister = unwrapRelation(data.lister);
  const booking = unwrapRelation(data.booking);

  if (!lister || !booking) {
    throw new Error("Payout relations are incomplete");
  }

  return {
    ...data,
    lister,
    booking,
  };
}

function calculateHitPayFee(amount: number, fees: PlatformFees) {
  const variableFee = roundMoney(amount * fees.hitpay_percentage_fee);
  return roundMoney(Math.max(fees.hitpay_fixed_fee, variableFee + fees.hitpay_fixed_fee));
}

async function updateTransaction(
  transactionId: string,
  updates: Partial<Transaction>,
) {
  const admin = createAdminClient();
  const { error } = await admin
    .from("transactions")
    .update(updates)
    .eq("id", transactionId);

  if (error) {
    throw new Error(error.message);
  }
}

async function getTransactionByIdempotency(
  idempotencyKey: string,
): Promise<Transaction | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("transactions")
    .select("*")
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle<Transaction>();

  if (error) {
    throw new Error(error.message);
  }

  return data ?? null;
}

export async function getFeeConfig(): Promise<PlatformFees> {
  if (
    feeConfigCache &&
    Date.now() - feeConfigCache.fetchedAt < FIVE_MINUTES_MS
  ) {
    return feeConfigCache.value;
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("fee_config")
    .select("*")
    .order("key", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  const rows = (data ?? []) as FeeConfig[];
  const values = new Map(rows.map((row) => [row.key, Number(row.value)]));
  const mapped: PlatformFees = {
    hitpay_percentage_fee: values.get("hitpay_percentage_fee") ?? 0.034,
    hitpay_fixed_fee: values.get("hitpay_fixed_fee") ?? 0.5,
    platform_service_fee_renter:
      values.get("platform_service_fee_renter") ?? 0.05,
    platform_service_fee_lister:
      values.get("platform_service_fee_lister") ?? 0.05,
    platform_absorbs_hitpay_fee: normalizeBoolConfig(
      values.get("platform_absorbs_hitpay_fee") ?? 0,
    ),
    cancellation_flexible_full_refund_hours:
      values.get("cancellation_flexible_full_refund_hours") ?? 24,
    cancellation_moderate_full_refund_hours:
      values.get("cancellation_moderate_full_refund_hours") ?? 72,
    cancellation_strict_full_refund_hours:
      values.get("cancellation_strict_full_refund_hours") ?? 168,
    payout_delay_days: values.get("payout_delay_days") ?? 1,
    max_payout_retry_count: values.get("max_payout_retry_count") ?? 3,
  };

  feeConfigCache = {
    value: mapped,
    fetchedAt: Date.now(),
  };

  return mapped;
}

export async function getPlatformFees(): Promise<PlatformFees> {
  return getFeeConfig();
}

export async function createTransactionRecord(
  params: CreateTransactionParams,
): Promise<string> {
  const existing = await getTransactionByIdempotency(params.idempotencyKey);
  if (existing) {
    return existing.id;
  }

  const admin = createAdminClient();
  const payload = {
    booking_id: params.bookingId ?? null,
    renter_id: params.renterId,
    lister_id: params.listerId,
    event_type: params.eventType,
    gross_amount: roundMoney(params.grossAmount),
    hitpay_fee: roundMoney(params.hitpayFee),
    platform_fee: roundMoney(params.platformFee),
    net_amount: roundMoney(params.netAmount),
    currency: params.currency,
    hitpay_payment_request_id: params.hitpayPaymentRequestId ?? null,
    hitpay_payment_id: params.hitpayPaymentId ?? null,
    hitpay_refund_id: params.hitpayRefundId ?? null,
    hitpay_transfer_id: params.hitpayTransferId ?? null,
    external_reference: params.externalReference ?? null,
    external_notes: params.externalNotes ?? null,
    status: params.status ?? "pending",
    failure_reason: params.failureReason ?? null,
    idempotency_key: params.idempotencyKey,
    triggered_by: params.triggeredBy ?? null,
    triggered_by_role: params.triggeredByRole ?? null,
    metadata: params.metadata ?? {},
    processed_at: params.processedAt ?? null,
  };

  const { data, error } = await admin
    .from("transactions")
    .insert(payload)
    .select("id")
    .maybeSingle<{ id: string }>();

  if (error) {
    if (error.code === "23505") {
      const duplicate = await getTransactionByIdempotency(params.idempotencyKey);
      if (duplicate) {
        return duplicate.id;
      }
    }

    throw new Error(error.message);
  }

  if (!data?.id) {
    throw new Error("Failed to create transaction record");
  }

  return data.id;
}

async function createHitPayRefund(params: {
  paymentRequestId: string;
  paymentId: string;
  amount: number;
}) {
  const apiKey = process.env.HITPAY_API_KEY;
  if (!apiKey) {
    throw new Error("Missing required environment variable: HITPAY_API_KEY");
  }

  const body = new URLSearchParams({
    amount: roundMoney(params.amount).toFixed(2),
    payment_id: params.paymentId,
  });

  const response = await fetch(
    `${getHitPayApiUrl()}/payment-requests/${params.paymentRequestId}/refund`,
    {
      method: "POST",
      headers: {
        "X-BUSINESS-API-KEY": apiKey,
        "X-Requested-With": "XMLHttpRequest",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
      cache: "no-store",
    },
  );

  const rawText = await response.text();
  if (!response.ok) {
    if (
      /payment request.*expired|expired request|already expired|invalid state/i.test(rawText)
    ) {
      throw new Error(`HITPAY_REQUEST_EXPIRED:${rawText}`);
    }

    throw new Error(rawText || "Failed to create HitPay refund");
  }

  let parsed: Record<string, unknown> = {};
  try {
    parsed = rawText ? (JSON.parse(rawText) as Record<string, unknown>) : {};
  } catch {
    parsed = {};
  }

  const refundId =
    typeof parsed.id === "string"
      ? parsed.id
      : typeof parsed.refund_id === "string"
        ? parsed.refund_id
        : "";

  return {
    id: refundId,
    raw: parsed,
  };
}

function validatePayoutDetails(lister: Profile) {
  if (!lister.payout_setup_completed || !lister.payout_method) {
    return false;
  }

  switch (lister.payout_method) {
    case "bank":
      return Boolean(
        lister.bank_name &&
          lister.bank_account_number &&
          lister.bank_account_name &&
          lister.bank_kyc_verified,
      );
    case "gcash":
      return Boolean(lister.gcash_phone_number);
    case "maya":
      return Boolean(lister.maya_phone_number);
    default:
      return false;
  }
}

function isMissingColumnError(error: unknown, columnName: string) {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "";

  return (
    message.includes(columnName) &&
    /column|schema cache|does not exist|Could not find/i.test(message)
  );
}

async function linkPayoutToBookingIfSupported(
  client: AnyClient,
  bookingId: string,
  payoutId: string,
) {
  const { error } = await client
    .from("bookings")
    .update({ payout_id: payoutId })
    .eq("id", bookingId);

  if (error) {
    if (isMissingColumnError(error.message, "payout_id")) {
      console.warn(
        "bookings.payout_id column is missing; payout record created without booking link",
      );
      return;
    }

    throw new Error(error.message);
  }
}

async function insertPayoutRecord(
  client: AnyClient,
  payload: {
    lister_id: string;
    booking_id: string;
    amount: number;
    gross_amount?: number;
    platform_fee?: number;
    hitpay_fee?: number;
    net_amount?: number;
    currency: string;
    status: Payout["status"];
    payout_method: string | null;
    trigger_type?: PayoutTrigger;
    can_retry?: boolean;
    failure_reason?: string;
    notes?: string;
  },
): Promise<string> {
  const fullInsert = await client
    .from("payouts")
    .insert(payload)
    .select("id")
    .maybeSingle<{ id: string }>();

  if (!fullInsert.error && fullInsert.data?.id) {
    return fullInsert.data.id;
  }

  const shouldRetryWithMinimalShape =
    fullInsert.error &&
    [
      "gross_amount",
      "platform_fee",
      "hitpay_fee",
      "net_amount",
      "trigger_type",
      "can_retry",
      "failure_reason",
    ].some((column) => isMissingColumnError(fullInsert.error?.message, column));

  if (!shouldRetryWithMinimalShape) {
    throw new Error(fullInsert.error?.message ?? "Failed to create payout record");
  }

  const { data: fallbackInsert, error: fallbackInsertError } = await client
    .from("payouts")
    .insert({
      lister_id: payload.lister_id,
      booking_id: payload.booking_id,
      amount: payload.amount,
      currency: payload.currency,
      status: payload.status,
      payout_method: payload.payout_method,
      notes: payload.notes ?? null,
    })
    .select("id")
    .maybeSingle<{ id: string }>();

  if (fallbackInsertError || !fallbackInsert?.id) {
    throw new Error(
      fallbackInsertError?.message ?? "Failed to create payout record",
    );
  }

  return fallbackInsert.id;
}

async function getCompletedBookingsForPayoutReconciliation(client: AnyClient, userId: string) {
  const withPayoutLink = await client
    .from("bookings")
    .select("id, payout_id")
    .eq("lister_id", userId)
    .eq("status", "completed");

  if (!withPayoutLink.error) {
    return (withPayoutLink.data ?? []) as Array<Pick<Booking, "id" | "payout_id">>;
  }

  if (!isMissingColumnError(withPayoutLink.error.message, "payout_id")) {
    throw new Error(withPayoutLink.error.message);
  }

  console.warn(
    "bookings.payout_id column is missing; falling back to booking-only payout reconciliation",
  );

  const withoutPayoutLink = await client
    .from("bookings")
    .select("id")
    .eq("lister_id", userId)
    .eq("status", "completed");

  if (withoutPayoutLink.error) {
    throw new Error(withoutPayoutLink.error.message);
  }

  return ((withoutPayoutLink.data ?? []) as Array<Pick<Booking, "id">>).map((booking) => ({
    ...booking,
    payout_id: undefined,
  }));
}

async function createAutomaticPayoutRecord(
  client: AnyClient,
  booking: BookingWithRelations,
): Promise<string> {
  if (booking.payout_id) {
    const { data: linkedPayout, error: linkedPayoutError } = await client
      .from("payouts")
      .select("id")
      .eq("id", booking.payout_id)
      .maybeSingle<{ id: string }>();

    if (linkedPayoutError) {
      throw new Error(linkedPayoutError.message);
    }

    if (linkedPayout?.id) {
      return linkedPayout.id;
    }
  }

  const { data: existingPayout, error: existingPayoutError } = await client
    .from("payouts")
    .select("id")
    .eq("booking_id", booking.id)
    .maybeSingle<{ id: string }>();

  if (existingPayoutError) {
    throw new Error(existingPayoutError.message);
  }

  if (existingPayout?.id) {
    if (booking.payout_id !== existingPayout.id) {
      const { error: bookingLinkError } = await client
        .from("bookings")
        .update({ payout_id: existingPayout.id })
        .eq("id", booking.id);

      if (bookingLinkError) {
        throw new Error(bookingLinkError.message);
      }
    }

    return existingPayout.id;
  }

  const payoutAmount = roundMoney(booking.lister_payout);
  const payoutId = await insertPayoutRecord(client, {
    lister_id: booking.lister_id,
    booking_id: booking.id,
    amount: payoutAmount,
    gross_amount: payoutAmount,
    platform_fee: roundMoney(booking.service_fee_lister),
    hitpay_fee: roundMoney(booking.hitpay_fee ?? 0),
    net_amount: payoutAmount,
    currency: "SGD",
    status: "pending",
    payout_method: booking.lister.payout_method ?? null,
    trigger_type: "auto_after_completion",
    can_retry: false,
    notes: "Created by app-level fallback after booking completion.",
  });

  await linkPayoutToBookingIfSupported(client, booking.id, payoutId);

  await addBookingTimeline({
    bookingId: booking.id,
    status: "completed",
    previousStatus: "completed",
    actorId: null,
    actorRole: "system",
    title: "Payout initiated",
    description:
      `Payout of ${formatMoney(payoutAmount, "SGD")} to lister has been queued. ` +
      `Processing via ${booking.lister.payout_method ?? "configured method"}.`,
    metadata: {
      payout_id: payoutId,
      amount: payoutAmount,
      source: "app_fallback",
    },
  });

  await createNotification({
    userId: booking.lister_id,
    type: "payout_initiated",
    title: "Payout is being processed",
    body: `Your payout of ${formatMoney(payoutAmount, "SGD")} is being processed.`,
    bookingId: booking.id,
    actionUrl: "/dashboard/earnings",
  });

  return payoutId;
}

async function createDisputeRefund(params: {
  booking: BookingWithRelations;
  refundAmount: number;
  refundReason: RefundReason;
  adminId: string;
  note: string;
  eventType: Transaction["event_type"];
}) {
  if (params.refundAmount <= 0) {
    return { refundId: null, transactionId: null };
  }

  const admin = createAdminClient();
  const transactionId = await createTransactionRecord({
    bookingId: params.booking.id,
    renterId: params.booking.renter_id,
    listerId: params.booking.lister_id,
    eventType: "refund_initiated",
    grossAmount: params.refundAmount,
    hitpayFee: 0,
    platformFee: params.booking.service_fee_renter,
    netAmount: -params.refundAmount,
    currency: "SGD",
    hitpayPaymentRequestId: params.booking.hitpay_payment_request_id,
    hitpayPaymentId: params.booking.hitpay_payment_id,
    idempotencyKey: `dispute_refund_init_${params.booking.id}_${params.refundReason}`,
    triggeredBy: params.adminId,
    triggeredByRole: "admin",
    metadata: {
      dispute: true,
      note: params.note,
    },
  });

  const { data: refundRow, error: refundError } = await admin
    .from("refunds")
    .insert({
      booking_id: params.booking.id,
      transaction_id: transactionId,
      renter_id: params.booking.renter_id,
      refund_reason: params.refundReason,
      original_amount: params.booking.total_price,
      refund_amount: params.refundAmount,
      platform_fee_retained: 0,
      deposit_refund: params.booking.deposit_amount,
      cancellation_fee: 0,
      cancellation_policy: params.booking.listing.cancellation_policy ?? null,
      currency: "SGD",
      note: params.note,
      processed_by: params.adminId,
      status: "pending",
    })
    .select("id")
    .maybeSingle<{ id: string }>();

  if (refundError || !refundRow) {
    await updateTransaction(transactionId, {
      status: "failed",
      failure_reason: refundError?.message ?? "Failed to create refund row",
    });
    throw new Error(refundError?.message ?? "Failed to create refund row");
  }

  try {
    const hitpayRefund = await createHitPayRefund({
      paymentRequestId: params.booking.hitpay_payment_request_id ?? "",
      paymentId: params.booking.hitpay_payment_id ?? "",
      amount: params.refundAmount,
    });

    await admin
      .from("refunds")
      .update({
        status: "completed",
        hitpay_refund_id: hitpayRefund.id || null,
        hitpay_payment_id: params.booking.hitpay_payment_id,
        processed_by: params.adminId,
        processed_at: new Date().toISOString(),
      })
      .eq("id", refundRow.id);

    await admin
      .from("bookings")
      .update({
        refund_id: refundRow.id,
        refunded_at: new Date().toISOString(),
        refund_amount: params.refundAmount,
      })
      .eq("id", params.booking.id);

    await updateTransaction(transactionId, {
      status: "completed",
      event_type: params.eventType,
      hitpay_refund_id: hitpayRefund.id || undefined,
      processed_at: new Date().toISOString(),
    });

    return { refundId: refundRow.id, transactionId };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Refund processing failed";

    if (isHitPayExpiredRequestError(error)) {
      await admin
        .from("refunds")
        .update({
          status: "processing",
          failure_reason: message,
          processed_by: params.adminId,
        })
        .eq("id", refundRow.id);

      await updateTransaction(transactionId, {
        status: "processing",
        failure_reason: message,
      });

      await admin
        .from("bookings")
        .update({
          refund_id: refundRow.id,
          refund_amount: roundMoney(params.refundAmount),
        })
        .eq("id", params.booking.id);

      await createNotification({
        userId: params.booking.renter_id,
        type: "refund_initiated",
        title: "Refund of " + formatMoney(params.refundAmount) + " is being processed",
        body: `Refund of ${formatMoney(params.refundAmount)} is being processed (5-10 days).`,
        bookingId: params.booking.id,
        actionUrl: `/dashboard/bookings/${params.booking.id}`,
      });

      await notifyAdmins({
        type: "refund_failed",
        title: `URGENT: Refund failed for booking ${params.booking.id}`,
        body: `HitPay refund requires manual processing for booking ${params.booking.id}. ${message}`,
        bookingId: params.booking.id,
        actionUrl: `/admin/bookings/${params.booking.id}`,
      });

      return { refundId: refundRow.id, transactionId };
    }

    await admin
      .from("refunds")
      .update({
        status: "failed",
        failure_reason: message,
        processed_by: params.adminId,
      })
      .eq("id", refundRow.id);

    await updateTransaction(transactionId, {
      status: "failed",
      failure_reason: message,
    });

    throw error;
  }
}

export async function createPaymentForBooking(
  bookingId: string,
): Promise<
  | { paymentUrl: string; paymentRequestId: string }
  | { error: string }
> {
  const admin = createAdminClient();

  try {
    const booking = await getBookingWithRelations(admin, bookingId);

    if (booking.status !== "lister_confirmation") {
      return { error: "Booking is not awaiting payment." };
    }

    if (booking.hitpay_payment_request_id && booking.hitpay_payment_url) {
      return {
        error: "Payment request already exists for this booking.",
      };
    }

    const fees = await getFeeConfig();
    const hitpayFee = calculateHitPayFee(booking.total_price, fees);
    const chargedToRenter = fees.platform_absorbs_hitpay_fee
      ? roundMoney(booking.total_price)
      : roundMoney(booking.total_price + hitpayFee);
    const transactionId = await createTransactionRecord({
      bookingId: booking.id,
      renterId: booking.renter_id,
      listerId: booking.lister_id,
      eventType: "payment_initiated",
      grossAmount: chargedToRenter,
      hitpayFee,
      platformFee: booking.service_fee_renter,
      netAmount: booking.subtotal,
      currency: "SGD",
      idempotencyKey: `payment_init_${booking.id}`,
      triggeredBy: booking.renter_id,
      triggeredByRole: "renter",
      metadata: {
        booking_total_price: booking.total_price,
        platform_absorbs_hitpay_fee: fees.platform_absorbs_hitpay_fee,
      },
    });

    const apiKey = process.env.HITPAY_API_KEY;
    if (!apiKey) {
      throw new Error("Missing required environment variable: HITPAY_API_KEY");
    }

    const body = new URLSearchParams({
      amount: chargedToRenter.toFixed(2),
      currency: "SGD",
      email: booking.renter.email,
      name: getDisplayName(booking.renter),
      purpose: `RentHub: ${booking.listing.title}`.slice(0, 100),
      reference_number: booking.id,
      redirect_url: `${getAppUrl()}/payment/success?booking=${booking.id}`,
      webhook: `${getAppUrl()}/api/webhooks/hitpay`,
      allow_repeated_payments: "false",
    });

    const response = await fetch(`${getHitPayApiUrl()}/payment-requests`, {
      method: "POST",
      headers: {
        "X-BUSINESS-API-KEY": apiKey,
        "X-Requested-With": "XMLHttpRequest",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
      cache: "no-store",
    });

    const rawText = await response.text();
    if (!response.ok) {
      await updateTransaction(transactionId, {
        status: "failed",
        failure_reason: rawText || "Failed to create HitPay payment request",
      });
      return {
        error: rawText || "Failed to create payment request with HitPay.",
      };
    }

    const parsed = rawText
      ? (JSON.parse(rawText) as Record<string, unknown>)
      : {};
    const paymentRequestId =
      typeof parsed.id === "string" ? parsed.id : undefined;
    const paymentUrl = typeof parsed.url === "string" ? parsed.url : undefined;

    if (!paymentRequestId || !paymentUrl) {
      await updateTransaction(transactionId, {
        status: "failed",
        failure_reason: "HitPay response did not include payment request details",
      });
      return {
        error: "HitPay did not return a usable payment link.",
      };
    }

    const { error: bookingError } = await admin
      .from("bookings")
      .update({
        hitpay_payment_request_id: paymentRequestId,
        hitpay_payment_url: paymentUrl,
        hitpay_fee: roundMoney(hitpayFee),
        net_collected: roundMoney(chargedToRenter),
      })
      .eq("id", booking.id);

    if (bookingError) {
      await updateTransaction(transactionId, {
        status: "failed",
        failure_reason: bookingError.message,
      });
      return {
        error: "Payment link was created but booking could not be updated safely.",
      };
    }

    await updateTransaction(transactionId, {
      status: "completed",
      hitpay_payment_request_id: paymentRequestId,
      external_reference: paymentUrl,
      processed_at: new Date().toISOString(),
    });

    await createNotification({
      userId: booking.renter_id,
      type: "payment_initiated",
      title: "Complete payment to confirm your booking",
      body: "Complete payment to confirm your booking",
      listingId: booking.listing_id,
      bookingId: booking.id,
      fromUserId: booking.lister_id,
      actionUrl: `/renter/rentals/${booking.id}`,
    });

    revalidatePaymentViews();

    return {
      paymentUrl,
      paymentRequestId,
    };
  } catch (error) {
    console.error("createPaymentForBooking failed:", error);
    return {
      error:
        error instanceof Error
          ? error.message
          : "Could not create payment for booking.",
    };
  }
}

export async function handlePaymentConfirmed(params: {
  hitpayPaymentId: string;
  hitpayPaymentRequestId: string;
  bookingId: string;
  amount: number;
  currency: string;
}): Promise<void> {
  const admin = createAdminClient();
  const idempotencyKey = `payment_confirmed_${params.bookingId}`;

  try {
    const existing = await getTransactionByIdempotency(idempotencyKey);
    if (existing?.status === "completed") {
      console.log("[PAYMENTS] Payment confirmation already processed:", params.bookingId);
      return;
    }

    const booking = await getBookingWithRelations(admin, params.bookingId);

    if (booking.status === "confirmed") {
      return;
    }

    if (
      booking.status !== "lister_confirmation" &&
      booking.status !== "cancelled_by_renter" &&
      booking.status !== "cancelled_by_lister"
    ) {
      console.log("[PAYMENTS] Ignoring payment confirmation for status:", booking.status);
      return;
    }

    const transactionId = await createTransactionRecord({
      bookingId: booking.id,
      renterId: booking.renter_id,
      listerId: booking.lister_id,
      eventType: "payment_completed",
      grossAmount: params.amount,
      hitpayFee: booking.hitpay_fee ?? 0,
      platformFee: booking.service_fee_renter,
      netAmount: booking.subtotal,
      currency: params.currency,
      hitpayPaymentRequestId: params.hitpayPaymentRequestId,
      hitpayPaymentId: params.hitpayPaymentId,
      idempotencyKey,
      triggeredBy: null,
      triggeredByRole: "system",
      metadata: {
        source: "webhook",
      },
    });

    const now = new Date().toISOString();
    const { error: bookingError } = await admin
      .from("bookings")
      .update({
        status: booking.status === "lister_confirmation" ? "lister_confirmation" : booking.status,
        paid_at: now,
        hitpay_payment_id: params.hitpayPaymentId,
        hitpay_payment_request_id: params.hitpayPaymentRequestId,
        hitpay_payment_status: "completed",
        stock_deducted: true,
        last_webhook_at: now,
      })
      .eq("id", booking.id)
      .in("status", ["lister_confirmation", "cancelled_by_renter", "cancelled_by_lister"]);

    if (bookingError) {
      await updateTransaction(transactionId, {
        status: "failed",
        failure_reason: bookingError.message,
      });
      throw new Error(bookingError.message);
    }

    await updateTransaction(transactionId, {
      status: "completed",
      processed_at: now,
    });

    await addBookingTimeline({
      bookingId: booking.id,
      status: "lister_confirmation",
      previousStatus: "lister_confirmation",
      actorRole: "system",
      title: "Payment confirmed",
      description: `Payment of ${formatMoney(params.amount, params.currency)} confirmed via HitPay. Waiting for the lister to confirm availability within 24 hours.`,
      metadata: {
        amount: params.amount,
        currency: params.currency,
        hitpay_payment_id: params.hitpayPaymentId,
        hitpay_payment_request_id: params.hitpayPaymentRequestId,
      },
    });

    await notifyPaymentConfirmed({
      renterId: booking.renter_id,
      listerId: booking.lister_id,
      renterName: getDisplayName(booking.renter),
      listerName: getDisplayName(booking.lister),
      listingTitle: booking.listing.title,
      bookingId: booking.id,
      amount: params.amount,
      rentalUnits: booking.rental_units,
      pricingPeriod: booking.pricing_period,
      quantity: booking.quantity,
      paymentReference: params.hitpayPaymentId,
      listerPayout: booking.lister_payout,
    });

    revalidatePaymentViews();
  } catch (error) {
    console.error("handlePaymentConfirmed failed:", error);
  }
}

export async function processCancellationRefund(
  bookingId: string,
  options?: {
    refundReason?: RefundReason;
    cancelledBy?: "renter" | "lister";
    refundAmountOverride?: number;
    policyAppliedOverride?: string;
    reasonOverride?: string;
  },
): Promise<{ refundAmount: number; message: string } | { error: string }> {
  const admin = createAdminClient();

  try {
    const booking = await getBookingWithRelations(admin, bookingId);

    if (booking.refund_id) {
      return { error: "Refund already processed" };
    }

    if (!booking.paid_at) {
      return { refundAmount: 0, message: "No payment made, nothing to refund" };
    }

    const cancelledBy =
      options?.cancelledBy ??
      (booking.cancelled_by === booking.lister_id ? "lister" : "renter");

    let refundAmount = 0;
    let cancellationFee = 0;
    let platformFeeRetained = 0;
    let depositRefund = 0;
    let reason = options?.reasonOverride ?? "Refund processed";
    let policyApplied = options?.policyAppliedOverride ?? "manual_override";

    if (typeof options?.refundAmountOverride === "number") {
      refundAmount = roundMoney(options.refundAmountOverride);
      depositRefund = roundMoney(Math.min(booking.deposit_amount, refundAmount));
      cancellationFee = roundMoney(
        Math.max(0, booking.total_price - refundAmount),
      );
      platformFeeRetained = roundMoney(
        Math.max(0, booking.total_price - refundAmount - booking.deposit_amount),
      );
    } else {
      const { data: calculation, error: calculationError } = await admin.rpc(
        "calculate_cancellation_refund",
        {
          p_booking_id: booking.id,
          p_cancelled_by: cancelledBy,
        },
      );

      if (calculationError) {
        throw new Error(calculationError.message);
      }

      const result = (calculation ?? {}) as CancellationRefundCalculation;
      refundAmount = roundMoney(Number(result.refund_amount ?? 0));
      cancellationFee = roundMoney(Number(result.cancellation_fee ?? 0));
      platformFeeRetained = roundMoney(
        Number(result.platform_fee_retained ?? 0),
      );
      depositRefund = roundMoney(Number(result.deposit_refund ?? 0));
      reason = options?.reasonOverride ?? String(result.reason ?? "Refund processed");
      policyApplied =
        options?.policyAppliedOverride ?? String(result.policy_applied ?? "unknown");
    }

    if (refundAmount <= 0) {
      await createTransactionRecord({
        bookingId: booking.id,
        renterId: booking.renter_id,
        listerId: booking.lister_id,
        eventType: "refund_initiated",
        grossAmount: 0,
        hitpayFee: 0,
        platformFee: platformFeeRetained,
        netAmount: 0,
        currency: "SGD",
        idempotencyKey: `refund_init_${booking.id}_zero`,
        triggeredBy: booking.cancelled_by,
        triggeredByRole: cancelledBy,
        metadata: {
          reason,
          policy_applied: policyApplied,
        },
        status: "completed",
        processedAt: new Date().toISOString(),
      });

      return { refundAmount: 0, message: reason };
    }

    const refundReason =
      options?.refundReason ??
      (cancelledBy === "lister"
        ? "booking_cancelled_by_lister"
        : "booking_cancelled_by_renter");

    const transactionId = await createTransactionRecord({
      bookingId: booking.id,
      renterId: booking.renter_id,
      listerId: booking.lister_id,
      eventType: "refund_initiated",
      grossAmount: refundAmount,
      hitpayFee: 0,
      platformFee: platformFeeRetained,
      netAmount: -refundAmount,
      currency: "SGD",
      hitpayPaymentRequestId: booking.hitpay_payment_request_id,
      hitpayPaymentId: booking.hitpay_payment_id,
      idempotencyKey: `refund_init_${booking.id}`,
      triggeredBy: booking.cancelled_by,
      triggeredByRole: cancelledBy,
      metadata: {
        reason,
        policy_applied: policyApplied,
        cancellation_fee: cancellationFee,
      },
    });

    const { data: refundRow, error: refundError } = await admin
      .from("refunds")
      .insert({
        booking_id: booking.id,
        transaction_id: transactionId,
        renter_id: booking.renter_id,
        refund_reason: refundReason,
        original_amount: booking.total_price,
        refund_amount: refundAmount,
        platform_fee_retained: platformFeeRetained,
        deposit_refund: depositRefund,
        cancellation_fee: cancellationFee,
        cancellation_policy: policyApplied,
        currency: "SGD",
        hitpay_payment_id: booking.hitpay_payment_id,
        note: reason,
        status: "pending",
      })
      .select("id")
      .maybeSingle<{ id: string }>();

    if (refundError || !refundRow) {
      await updateTransaction(transactionId, {
        status: "failed",
        failure_reason: refundError?.message ?? "Failed to create refund record",
      });
      return {
        error: refundError?.message ?? "Failed to create refund record",
      };
    }

    try {
      const hitpayRefund = await createHitPayRefund({
        paymentRequestId: booking.hitpay_payment_request_id ?? "",
        paymentId: booking.hitpay_payment_id ?? "",
        amount: refundAmount,
      });

      const now = new Date().toISOString();

      await admin
        .from("refunds")
        .update({
          status: "completed",
          hitpay_refund_id: hitpayRefund.id || null,
          processed_at: now,
        })
        .eq("id", refundRow.id);

      await updateTransaction(transactionId, {
        status: "completed",
        hitpay_refund_id: hitpayRefund.id || undefined,
        processed_at: now,
      });

      await admin
        .from("bookings")
        .update({
          refund_id: refundRow.id,
          refunded_at: now,
          refund_amount: refundAmount,
        })
        .eq("id", booking.id);

      await addBookingTimeline({
        bookingId: booking.id,
        status: booking.status,
        previousStatus: booking.status,
        actorRole: "system",
        title: "Refund processed",
        description: `Refund of ${formatMoney(refundAmount)} initiated. ${reason}. Note: refunds may take 5-10 business days to appear.`,
        metadata: {
          refund_id: refundRow.id,
          refund_amount: refundAmount,
          reason,
        },
      });

      void notifyRefundInitiated({
        renterId: booking.renter_id,
        renterName: getDisplayName(booking.renter),
        refundAmount,
        originalAmount: booking.total_price,
        reason,
        listingTitle: booking.listing.title,
        bookingId: booking.id,
      }).catch((error) => {
        console.error("processCancellationRefund notification failed:", error);
      });

      revalidatePaymentViews();

      return {
        refundAmount,
        message: `Refund of ${formatMoney(refundAmount)} processed.`,
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Refund processing failed";

      if (isHitPayExpiredRequestError(error)) {
        await admin
          .from("refunds")
          .update({
            status: "processing",
            failure_reason: message,
          })
          .eq("id", refundRow.id);

        await updateTransaction(transactionId, {
          status: "processing",
          failure_reason: message,
        });

        await admin
          .from("bookings")
          .update({
            refund_id: refundRow.id,
            refund_amount: roundMoney(refundAmount),
          })
          .eq("id", booking.id);

        void notifyRefundInitiated({
          renterId: booking.renter_id,
          renterName: getDisplayName(booking.renter),
          refundAmount,
          originalAmount: booking.total_price,
          reason,
          listingTitle: booking.listing.title,
          bookingId: booking.id,
        }).catch((error) => {
          console.error("processCancellationRefund notification failed:", error);
        });

        await notifyAdmins({
          type: "refund_failed",
          title: `URGENT: Refund failed for booking ${booking.id}`,
          body: `HitPay refund requires manual processing for booking ${booking.id}. ${message}`,
          bookingId: booking.id,
          actionUrl: `/admin/bookings/${booking.id}`,
        });

        return {
          refundAmount,
          message: `Refund of ${formatMoney(refundAmount)} requires manual processing.`,
        };
      }

      await admin
        .from("refunds")
        .update({
          status: "failed",
          failure_reason: message,
        })
        .eq("id", refundRow.id);

      await updateTransaction(transactionId, {
        status: "failed",
        failure_reason: message,
      });

      await addBookingTimeline({
        bookingId: booking.id,
        status: booking.status,
        previousStatus: booking.status,
        actorRole: "system",
        title: "Refund failed - admin notified",
        description: "Refund processing failed and admins have been notified.",
        metadata: {
          error: message,
        },
      });

      await notifyAdmins({
        type: "refund_failed",
        title: "URGENT: Refund failed",
        body: `Refund failed for booking ${booking.id}. ${message}`,
        bookingId: booking.id,
        actionUrl: `/admin/bookings/${booking.id}`,
      });

      return {
        error: `Refund could not be completed automatically: ${message}`,
      };
    }
  } catch (error) {
    console.error("processCancellationRefund failed:", error);
    return {
      error:
        error instanceof Error ? error.message : "Could not process refund.",
    };
  }
}

export async function handleFailedPayout(
  payoutId: string,
  failureReason: string,
): Promise<void> {
  const admin = createAdminClient();

  try {
    const payout = await getPayoutWithRelations(admin, payoutId);
    await admin
      .from("payouts")
      .update({
        status: "failed",
        failure_reason: failureReason,
        can_retry: true,
      })
      .eq("id", payout.id);

    await createTransactionRecord({
      bookingId: payout.booking_id,
      renterId: payout.booking.renter_id,
      listerId: payout.lister_id,
      eventType: "payout_failed",
      grossAmount: payout.amount,
      hitpayFee: payout.hitpay_fee,
      platformFee: payout.platform_fee,
      netAmount: payout.net_amount,
      currency: payout.currency,
      idempotencyKey: `payout_failed_${payout.id}_${payout.retry_count}`,
      triggeredBy: payout.lister_id,
      triggeredByRole: "system",
      failureReason,
      status: "completed",
      processedAt: new Date().toISOString(),
      metadata: {
        payout_id: payout.id,
      },
    });

    await addBookingTimeline({
      bookingId: payout.booking_id ?? payout.booking.id,
      status: payout.booking.status,
      previousStatus: payout.booking.status,
      actorRole: "system",
      title: "Payout failed",
      description: `Your payout of ${formatMoney(payout.amount, payout.currency)} could not be processed.`,
      metadata: {
        reason: failureReason,
        payout_id: payout.id,
      },
    });

    await Promise.all([
      notifyPayoutFailed({
        listerId: payout.lister_id,
        listerName: getDisplayName(payout.lister),
        amount: payout.amount,
        reason: failureReason,
        bookingId: payout.booking_id ?? payout.booking.id,
      }),
      createNotification({
        userId: payout.lister_id,
        type: "payout_retry_available",
        title: "Request payout retry",
        body: "Once your payout details are updated, you can request a retry from Earnings.",
        bookingId: payout.booking_id ?? undefined,
        actionUrl: "/dashboard/earnings",
      }),
    ]);

    await notifyAdmins({
      type: "payout_failed_admin",
      title: `Payout failed for lister ${getDisplayName(payout.lister)}`,
      body: `Payout failed for lister ${getDisplayName(payout.lister)}. Reason: ${failureReason}`,
      bookingId: payout.booking_id ?? undefined,
      actionUrl: "/admin/payouts",
    });

    revalidatePaymentViews();
  } catch (error) {
    console.error("handleFailedPayout failed:", error);
  }
}

export async function processPayoutToLister(
  payoutId: string,
  adminId?: string,
): Promise<{ success: boolean; message: string } | { error: string }> {
  const admin = createAdminClient();

  try {
    const payout = await getPayoutWithRelations(admin, payoutId);

    if (payout.status !== "pending" && payout.status !== "failed") {
      return { error: "Only pending or failed payouts can be processed." };
    }

    const currentPayoutMethod = payout.lister.payout_method ?? null;

    const payoutInitiatedId = await createTransactionRecord({
      bookingId: payout.booking_id,
      renterId: payout.booking.renter_id,
      listerId: payout.lister_id,
      eventType: "payout_initiated",
      grossAmount: payout.amount,
      hitpayFee: payout.hitpay_fee,
      platformFee: payout.platform_fee,
      netAmount: payout.net_amount || payout.amount,
      currency: payout.currency,
      idempotencyKey: `payout_initiated_${payout.id}_${payout.retry_count}`,
      triggeredBy: adminId ?? null,
      triggeredByRole: adminId ? "admin" : "system",
      metadata: {
        payout_id: payout.id,
        payout_method: currentPayoutMethod,
      },
    });

    if (!validatePayoutDetails(payout.lister)) {
      await updateTransaction(payoutInitiatedId, {
        status: "failed",
        failure_reason: "Invalid payout details",
      });

      await handleFailedPayout(payout.id, "Invalid payout details");
      return { error: "Payout failed: invalid details" };
    }

    const now = new Date().toISOString();
    const reference =
      payout.reference_number || `MANUAL-${payout.id.slice(0, 8).toUpperCase()}`;
    const triggerType: PayoutTrigger = adminId
      ? payout.retry_count > 0
        ? "retry_after_failure"
        : "admin_manual"
      : payout.retry_count > 0
        ? "retry_after_failure"
        : "auto_after_completion";
    const netAmount = payout.net_amount || payout.amount;

    const { error: updateError } = await admin
      .from("payouts")
      .update({
        status: "completed",
        processed_at: now,
        processed_by: adminId ?? null,
        trigger_type: triggerType,
        net_amount: netAmount,
        payout_method: currentPayoutMethod,
        reference_number: reference,
        failure_reason: null,
        can_retry: false,
      })
      .eq("id", payout.id);

    if (updateError) {
      await updateTransaction(payoutInitiatedId, {
        status: "failed",
        failure_reason: updateError.message,
      });
      return { error: updateError.message };
    }

    const transactionId = await createTransactionRecord({
      bookingId: payout.booking_id,
      renterId: payout.booking.renter_id,
      listerId: payout.lister_id,
      eventType: "payout_completed",
      grossAmount: payout.amount,
      hitpayFee: payout.hitpay_fee,
      platformFee: payout.platform_fee,
      netAmount,
      currency: payout.currency,
      externalReference: reference,
      idempotencyKey: `payout_completed_${payout.id}`,
      triggeredBy: adminId ?? null,
      triggeredByRole: adminId ? "admin" : "system",
      status: "completed",
      processedAt: now,
      metadata: {
        payout_id: payout.id,
        payout_method: currentPayoutMethod,
      },
    });

    await admin
      .from("payouts")
      .update({
        transaction_id: transactionId,
      })
      .eq("id", payout.id);

    await admin
      .from("bookings")
      .update({
        payout_at: now,
        payout_id: payout.id,
      })
      .eq("id", payout.booking_id ?? payout.booking.id);

    await addBookingTimeline({
      bookingId: payout.booking_id ?? payout.booking.id,
      status: payout.booking.status,
      previousStatus: payout.booking.status,
      actorRole: "system",
      title: "Payment sent to lister",
      description: `Payout of ${formatMoney(payout.amount, payout.currency)} processed via ${currentPayoutMethod ?? "configured method"}.`,
      metadata: {
        payout_id: payout.id,
        amount: payout.amount,
        reference,
        payout_method: currentPayoutMethod,
      },
    });

    void notifyPayoutCompleted({
      listerId: payout.lister_id,
      listerName: getDisplayName(payout.lister),
      amount: payout.amount,
      method: currentPayoutMethod ?? "configured method",
      reference,
      bookingId: payout.booking_id ?? payout.booking.id,
    }).catch((error) => {
      console.error("processPayoutToLister completion notification failed:", error);
    });

    revalidatePaymentViews();

    return {
      success: true,
      message: `Payout of ${formatMoney(payout.amount, payout.currency)} processed successfully.`,
    };
  } catch (error) {
    console.error("processPayoutToLister failed:", error);
    return {
      error:
        error instanceof Error ? error.message : "Could not process payout.",
    };
  }
}

export async function autoTriggerPayout(
  bookingId: string,
): Promise<{ success: true; payoutId?: string } | { success: false; error: string }> {
  const admin = createAdminClient();

  try {
    const fees = await getFeeConfig();
    const booking = await getBookingWithRelations(admin, bookingId);

    if (!validatePayoutDetails(booking.lister)) {
      let failedPayoutId = booking.payout_id;

      if (failedPayoutId) {
        const { error: failedUpdateError } = await admin
          .from("payouts")
          .update({
            amount: roundMoney(booking.lister_payout),
            gross_amount: roundMoney(booking.lister_payout),
            platform_fee: roundMoney(booking.service_fee_lister),
            hitpay_fee: roundMoney(booking.hitpay_fee ?? 0),
            net_amount: roundMoney(booking.lister_payout),
            payout_method: booking.lister.payout_method ?? null,
            status: "failed",
            trigger_type: "auto_after_completion",
            can_retry: true,
            failure_reason: "Invalid payout details",
            notes: "Auto-payout could not start because payout settings are incomplete.",
          })
          .eq("id", failedPayoutId);

        if (failedUpdateError) {
          throw new Error(failedUpdateError.message);
        }
      } else {
        failedPayoutId = await insertPayoutRecord(admin, {
          lister_id: booking.lister_id,
          booking_id: booking.id,
          amount: roundMoney(booking.lister_payout),
          gross_amount: roundMoney(booking.lister_payout),
          platform_fee: roundMoney(booking.service_fee_lister),
          hitpay_fee: roundMoney(booking.hitpay_fee ?? 0),
          net_amount: roundMoney(booking.lister_payout),
          currency: "SGD",
          status: "failed",
          payout_method: booking.lister.payout_method ?? null,
          trigger_type: "auto_after_completion",
          can_retry: true,
          failure_reason: "Invalid payout details",
          notes: "Auto-payout could not start because payout settings are incomplete.",
        });
        await linkPayoutToBookingIfSupported(admin, booking.id, failedPayoutId);
      }

      await handleFailedPayout(failedPayoutId, "Invalid payout details");
      return {
        success: false,
        error: "Payout could not start because payout settings are incomplete.",
      };
    }

    let payoutId: string | null = null;

    try {
      const { data, error } = await admin.rpc("trigger_auto_payout", {
        p_booking_id: bookingId,
      });

      if (error) {
        throw new Error(error.message);
      }

      const payload = (data ?? {}) as Record<string, unknown>;
      const payloadError =
        typeof payload.error === "string" ? payload.error : null;

      payoutId =
        typeof payload.payout_id === "string" ? payload.payout_id : null;

      if (payloadError) {
        throw new Error(payloadError);
      }

      if (!payoutId) {
        throw new Error("Payout trigger returned without creating a payout record.");
      }
    } catch (rpcError) {
      console.error("autoTriggerPayout RPC failed, falling back to app insert:", rpcError);
      payoutId = await createAutomaticPayoutRecord(admin, booking);
    }

    if (fees.payout_delay_days === 0 && payoutId) {
      await processPayoutToLister(payoutId);
    }

    revalidatePaymentViews();
    return { success: true, payoutId };
  } catch (error) {
    console.error("autoTriggerPayout failed:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Could not create payout.",
    };
  }
}

export async function reconcileMissingPayoutsForLister(userId: string): Promise<void> {
  const admin = createAdminClient();

  try {
    const [bookings, payoutsResult] = await Promise.all([
      getCompletedBookingsForPayoutReconciliation(admin, userId),
      admin
        .from("payouts")
        .select("id, booking_id")
        .eq("lister_id", userId),
    ]);

    if (payoutsResult.error) {
      throw new Error(payoutsResult.error.message);
    }

    const payoutsByBookingId = new Map(
      ((payoutsResult.data ?? []) as Array<Pick<Payout, "id" | "booking_id">>)
        .filter((payout) => Boolean(payout.booking_id))
        .map((payout) => [payout.booking_id as string, payout.id]),
    );

    for (const booking of bookings) {
      const existingPayoutId = payoutsByBookingId.get(booking.id) ?? null;

      if (existingPayoutId) {
        if (booking.payout_id !== existingPayoutId) {
          await linkPayoutToBookingIfSupported(admin, booking.id, existingPayoutId);
        }
        continue;
      }

      await autoTriggerPayout(booking.id);
    }
  } catch (error) {
    console.error("reconcileMissingPayoutsForLister failed:", error);
  }
}

export async function retryFailedPayout(
  payoutId: string,
): Promise<ActionResponse> {
  try {
    const auth = await getCurrentUser();
    if (!auth?.user) {
      return { error: "You must be signed in." };
    }

    const admin = createAdminClient();
    const payout = await getPayoutWithRelations(admin, payoutId);

    if (payout.lister_id !== auth.user.id) {
      return { error: "You are not allowed to retry this payout." };
    }

    if (payout.status !== "failed" || !payout.can_retry) {
      return { error: "This payout cannot be retried." };
    }

    const fees = await getFeeConfig();
    if (payout.retry_count >= fees.max_payout_retry_count) {
      return {
        error: "Max retry attempts reached. Please contact support.",
      };
    }

    if (!validatePayoutDetails(payout.lister)) {
      return {
        error: "Please update your payout settings before requesting a retry.",
      };
    }

    const now = new Date().toISOString();
    const nextRetryCount = payout.retry_count + 1;
    const { error } = await admin
      .from("payouts")
      .update({
        retry_count: nextRetryCount,
        last_retry_at: now,
        status: "pending",
        can_retry: false,
        failure_reason: null,
      })
      .eq("id", payout.id);

    if (error) {
      return { error: error.message };
    }

    await createTransactionRecord({
      bookingId: payout.booking_id,
      renterId: payout.booking.renter_id,
      listerId: payout.lister_id,
      eventType: "payout_retry_requested",
      grossAmount: payout.amount,
      hitpayFee: payout.hitpay_fee,
      platformFee: payout.platform_fee,
      netAmount: payout.net_amount || payout.amount,
      currency: payout.currency,
      idempotencyKey: `payout_retry_requested_${payout.id}_${nextRetryCount}`,
      triggeredBy: auth.user.id,
      triggeredByRole: "lister",
      status: "completed",
      processedAt: now,
      metadata: {
        payout_id: payout.id,
      },
    });

    await notifyAdmins({
      type: "payout_retry_request",
      title: "Payout retry requested",
      body: `Lister ${getDisplayName(payout.lister)} has requested a payout retry.`,
      bookingId: payout.booking_id ?? undefined,
      fromUserId: auth.user.id,
      actionUrl: "/admin/payouts",
    });

    await addBookingTimeline({
      bookingId: payout.booking_id ?? payout.booking.id,
      status: payout.booking.status,
      previousStatus: payout.booking.status,
      actorId: auth.user.id,
      actorRole: "lister",
      title: "Payout retry requested",
      metadata: {
        payout_id: payout.id,
        retry_count: nextRetryCount,
      },
    });

    revalidatePaymentViews();

    return {
      success: "Retry requested. We'll process it shortly.",
    };
  } catch (error) {
    console.error("retryFailedPayout failed:", error);
    return { error: "Could not request payout retry." };
  }
}

export async function holdPaymentForDispute(bookingId: string): Promise<void> {
  const admin = createAdminClient();

  try {
    const booking = await getBookingWithRelations(admin, bookingId);

    if (booking.payout_id) {
      await admin
        .from("payouts")
        .update({
          status: "processing",
        })
        .eq("id", booking.payout_id)
        .eq("status", "pending");
    }

    await createTransactionRecord({
      bookingId: booking.id,
      renterId: booking.renter_id,
      listerId: booking.lister_id,
      eventType: "dispute_hold",
      grossAmount: booking.net_collected ?? booking.total_price,
      hitpayFee: booking.hitpay_fee ?? 0,
      platformFee: booking.service_fee_renter + booking.service_fee_lister,
      netAmount: booking.lister_payout,
      currency: "SGD",
      idempotencyKey: `dispute_hold_${booking.id}`,
      triggeredBy: null,
      triggeredByRole: "system",
      status: "completed",
      processedAt: new Date().toISOString(),
      metadata: {
        payout_id: booking.payout_id,
      },
    });

    await notifyAdmins({
      type: "dispute_hold",
      title: "Payment held for dispute",
      body: `Payment of ${formatMoney(booking.net_collected ?? booking.total_price)} held due to dispute on booking ${booking.id}.`,
      bookingId: booking.id,
      actionUrl: `/admin/bookings/${booking.id}`,
    });

    await createNotification({
      userId: booking.lister_id,
      type: "dispute_hold",
      title: "Payment held due to dispute",
      body: "Payment held due to dispute",
      bookingId: booking.id,
      actionUrl: `/dashboard/bookings/${booking.id}`,
    });
  } catch (error) {
    console.error("holdPaymentForDispute failed:", error);
  }
}

export async function resolveDisputePayment(params: {
  bookingId: string;
  adminId: string;
  resolutionType: DisputeResolutionType;
  renterRefundPercent?: number;
  listerPayoutPercent?: number;
  resolutionNotes: string;
  evidenceReviewed?: string;
}): Promise<ActionResponse> {
  try {
    const auth = await requireAdminUser();
    const effectiveAdminId =
      params.adminId === "self" || !params.adminId ? auth.user.id : params.adminId;
    const admin = createAdminClient();
    const booking = await getBookingWithRelations(admin, params.bookingId);
    const total = roundMoney(booking.net_collected ?? booking.total_price);
    const platformFee = roundMoney(
      booking.service_fee_renter + booking.service_fee_lister,
    );
    const distributable = roundMoney(total - platformFee);

    let renterRefundAmount = 0;
    let listerPayoutAmount = 0;
    let platformKeepsAmount = 0;

    if (params.resolutionType === "full_refund_renter") {
      renterRefundAmount = roundMoney(booking.total_price);
      listerPayoutAmount = 0;
      platformKeepsAmount = roundMoney(total - renterRefundAmount);
    } else if (params.resolutionType === "full_payout_lister") {
      renterRefundAmount = 0;
      listerPayoutAmount = roundMoney(booking.lister_payout);
      platformKeepsAmount = roundMoney(total - listerPayoutAmount);
    } else {
      renterRefundAmount = roundMoney(
        distributable * ((params.renterRefundPercent ?? 0) / 100),
      );
      listerPayoutAmount = roundMoney(
        distributable * ((params.listerPayoutPercent ?? 0) / 100),
      );
      platformKeepsAmount = roundMoney(
        distributable - renterRefundAmount - listerPayoutAmount,
      );
    }

    const { data: resolution, error: resolutionError } = await admin
      .from("dispute_resolutions")
      .insert({
        booking_id: booking.id,
        admin_id: effectiveAdminId,
        resolution_type: params.resolutionType,
        renter_refund_amount: renterRefundAmount,
        lister_payout_amount: listerPayoutAmount,
        platform_keeps_amount: platformKeepsAmount,
        renter_refund_percent: params.renterRefundPercent ?? 0,
        lister_payout_percent: params.listerPayoutPercent ?? 0,
        resolution_notes: params.resolutionNotes,
        evidence_reviewed: params.evidenceReviewed ?? null,
      })
      .select("*")
      .maybeSingle<DisputeResolution>();

    if (resolutionError || !resolution) {
      return {
        error: resolutionError?.message ?? "Failed to create dispute resolution.",
      };
    }

    let refundId: string | null = null;
    let payoutId: string | null = null;

    if (renterRefundAmount > 0) {
      const refundResult = await createDisputeRefund({
        booking,
        refundAmount: renterRefundAmount,
        refundReason:
          params.resolutionType === "split"
            ? "dispute_split"
            : "dispute_resolved_renter",
        adminId: effectiveAdminId,
        note: params.resolutionNotes,
        eventType:
          params.resolutionType === "split"
            ? "dispute_split"
            : "dispute_released_renter",
      });

      refundId = refundResult.refundId;
    }

    if (listerPayoutAmount > 0) {
      const existingPayoutId = booking.payout_id;
      if (existingPayoutId) {
        await admin
          .from("payouts")
          .update({
            amount: roundMoney(listerPayoutAmount),
            gross_amount: roundMoney(listerPayoutAmount),
            platform_fee: roundMoney(platformKeepsAmount),
            net_amount: roundMoney(listerPayoutAmount),
            trigger_type: "dispute_resolved",
            status: "pending",
            can_retry: false,
            payout_method: booking.lister.payout_method ?? null,
            notes: `Updated from dispute resolution; platform_keeps_amount=${roundMoney(platformKeepsAmount).toFixed(2)}`,
          })
          .eq("id", existingPayoutId);

        payoutId = existingPayoutId;
      } else {
        const { data: createdPayout, error: payoutInsertError } = await admin
          .from("payouts")
          .insert({
            lister_id: booking.lister_id,
            booking_id: booking.id,
            amount: roundMoney(listerPayoutAmount),
            gross_amount: roundMoney(listerPayoutAmount),
            platform_fee: roundMoney(platformKeepsAmount),
            hitpay_fee: 0,
            net_amount: roundMoney(listerPayoutAmount),
            currency: "SGD",
            status: "pending",
            payout_method: booking.lister.payout_method ?? null,
            trigger_type: "dispute_resolved",
            can_retry: false,
            notes: `Created from dispute resolution; platform_keeps_amount=${roundMoney(platformKeepsAmount).toFixed(2)}`,
          })
          .select("id")
          .maybeSingle<{ id: string }>();

        if (payoutInsertError || !createdPayout) {
          return {
            error: payoutInsertError?.message ?? "Failed to create payout record.",
          };
        }

        payoutId = createdPayout.id;
        await admin.from("bookings").update({ payout_id: payoutId }).eq("id", booking.id);
      }

      await processPayoutToLister(payoutId, effectiveAdminId);

      await createTransactionRecord({
        bookingId: booking.id,
        renterId: booking.renter_id,
        listerId: booking.lister_id,
        eventType:
          params.resolutionType === "split"
            ? "dispute_split"
            : "dispute_released_lister",
        grossAmount: listerPayoutAmount,
        hitpayFee: 0,
        platformFee: platformKeepsAmount,
        netAmount: listerPayoutAmount,
        currency: "SGD",
        idempotencyKey: `dispute_payout_release_${booking.id}_${params.resolutionType}`,
        triggeredBy: effectiveAdminId,
        triggeredByRole: "admin",
        status: "completed",
        processedAt: new Date().toISOString(),
        metadata: {
          payout_id: payoutId,
          resolution_id: resolution.id,
          platform_keeps_amount: roundMoney(platformKeepsAmount),
        },
      });
    }

    const now = new Date().toISOString();
    await admin
      .from("bookings")
      .update({
        status: "completed",
        dispute_resolved_by: effectiveAdminId,
        dispute_resolved_at: now,
        dispute_resolution: params.resolutionType,
      })
      .eq("id", booking.id);

    await addBookingTimeline({
      bookingId: booking.id,
      status: "completed",
      previousStatus: "disputed",
      actorId: effectiveAdminId,
      actorRole: "admin",
      title: "Dispute resolved by admin",
      description: `Admin decision: ${params.resolutionType}. ${params.resolutionNotes}`,
      metadata: {
        resolution_type: params.resolutionType,
        renter_refund_amount: renterRefundAmount,
        lister_payout_amount: listerPayoutAmount,
        platform_keeps_amount: platformKeepsAmount,
        resolution_id: resolution.id,
      },
    });

    await notifyDisputeResolved({
      renterId: booking.renter_id,
      listerId: booking.lister_id,
      renterName: getDisplayName(booking.renter),
      listerName: getDisplayName(booking.lister),
      listingTitle: booking.listing.title,
      renterAmount: renterRefundAmount,
      listerAmount: listerPayoutAmount,
      resolutionNotes: params.resolutionNotes,
      bookingId: booking.id,
      resolutionType: params.resolutionType,
    });

    await logAdminAction({
      adminId: effectiveAdminId,
      action: "dispute_resolved",
      targetType: "booking",
      targetId: booking.id,
      details: {
        resolution_type: params.resolutionType,
        renter_refund_amount: renterRefundAmount,
        lister_payout_amount: listerPayoutAmount,
        platform_keeps_amount: platformKeepsAmount,
        refund_id: refundId,
        payout_id: payoutId,
      },
    });

    revalidatePaymentViews();

    return { success: "Dispute resolved successfully." };
  } catch (error) {
    console.error("resolveDisputePayment failed:", error);
    return { error: "Could not resolve dispute payment." };
  }
}

export async function getTransactionsForBooking(
  bookingId: string,
): Promise<Transaction[]> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("transactions")
      .select("*")
      .eq("booking_id", bookingId)
      .order("created_at", { ascending: true });

    if (error) {
      throw new Error(error.message);
    }

    return (data ?? []) as Transaction[];
  } catch (error) {
    console.error("getTransactionsForBooking failed:", error);
    return [];
  }
}

export async function getTransactionsForLister(
  userId: string,
): Promise<Transaction[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("transactions")
      .select("*")
      .eq("lister_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    return (data ?? []) as Transaction[];
  } catch (error) {
    console.error("getTransactionsForLister failed:", error);
    return [];
  }
}

export async function markPayoutFailedByAdmin(
  payoutId: string,
  reason: string,
): Promise<ActionResponse> {
  try {
    const auth = await requireAdminUser();
    const admin = createAdminClient();
    const trimmedReason = reason.trim();

    if (trimmedReason.length < 3) {
      return { error: "Failure reason must be at least 3 characters." };
    }

    const payout = await getPayoutWithRelations(admin, payoutId);
    const now = new Date().toISOString();

    const { error } = await admin
      .from("payouts")
      .update({
        status: "failed",
        failure_reason: trimmedReason,
        can_retry: true,
        updated_at: now,
      })
      .eq("id", payoutId);

    if (error) {
      return { error: error.message };
    }

    await createTransactionRecord({
      bookingId: payout.booking_id,
      renterId: payout.booking.renter_id,
      listerId: payout.lister_id,
      eventType: "payout_failed",
      grossAmount: payout.amount,
      hitpayFee: payout.hitpay_fee,
      platformFee: payout.platform_fee,
      netAmount: 0,
      currency: payout.currency,
      idempotencyKey: `payout_failed_admin_${payout.id}_${payout.retry_count}_${now}`,
      triggeredBy: auth.user.id,
      triggeredByRole: "admin",
      status: "failed",
      failureReason: trimmedReason,
      processedAt: now,
      metadata: {
        payout_id: payout.id,
      },
    });

    void notifyPayoutFailed({
      listerId: payout.lister_id,
      listerName: getDisplayName(payout.lister),
      amount: payout.amount,
      reason: trimmedReason,
      bookingId: payout.booking_id ?? payout.id,
    }).catch((error) => {
      console.error("markPayoutFailed notification failed:", error);
    });

    await logAdminAction({
      adminId: auth.user.id,
      action: "payout_marked_failed",
      targetType: "payout",
      targetId: payout.id,
      details: {
        reason: trimmedReason,
      },
    });

    revalidatePaymentViews();

    return { success: "Payout marked as failed." };
  } catch (error) {
    console.error("markPayoutFailedByAdmin failed:", error);
    return { error: "Could not mark payout as failed." };
  }
}

export async function getMyTransactions(
  userId: string,
  page = 1,
): Promise<PaginatedResponse<TransactionWithDetails>> {
  try {
    const supabase = await createClient();
    const pageSize = 20;
    const currentPage = Math.max(1, page);
    const from = (currentPage - 1) * pageSize;
    const to = from + pageSize - 1;

    const { data, error, count } = await supabase
      .from("transactions")
      .select(
        `
          *,
          booking:bookings(*),
          renter:profiles!transactions_renter_id_fkey(*),
          lister:profiles!transactions_lister_id_fkey(*)
        `,
        { count: "exact" },
      )
      .or(`renter_id.eq.${userId},lister_id.eq.${userId}`)
      .order("created_at", { ascending: false })
      .range(from, to);

    if (error) {
      throw new Error(error.message);
    }

    const items = ((data ?? []) as Array<
      Transaction & {
        booking: MaybeArray<Booking>;
        renter: MaybeArray<Profile>;
        lister: MaybeArray<Profile>;
      }
    >).flatMap((row) => {
      const renter = unwrapRelation(row.renter);
      const lister = unwrapRelation(row.lister);

      if (!renter || !lister) {
        return [];
      }

      return [
        {
          ...row,
          renter,
          lister,
          booking: unwrapRelation(row.booking) ?? undefined,
        },
      ];
    });

    return {
      data: items,
      totalCount: count ?? 0,
      totalPages: Math.max(1, Math.ceil((count ?? 0) / pageSize)),
      currentPage,
    };
  } catch (error) {
    console.error("getMyTransactions failed:", error);
    return {
      data: [],
      totalCount: 0,
      totalPages: 0,
      currentPage: Math.max(1, page),
    };
  }
}

export async function getRefundDetails(bookingId: string): Promise<Refund | null> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("refunds")
      .select("*")
      .eq("booking_id", bookingId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle<Refund>();

    if (error) {
      throw new Error(error.message);
    }

    return data ?? null;
  } catch (error) {
    console.error("getRefundDetails failed:", error);
    return null;
  }
}

export async function getEarningsSummary(userId: string): Promise<{
  totalEarned: number;
  pendingPayouts: number;
  pendingPayoutsAmount: number;
  completedPayouts: number;
  completedPayoutsAmount: number;
  failedPayouts: number;
  thisMonthEarned: number;
}> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("payouts")
      .select("*")
      .eq("lister_id", userId);

    if (error) {
      throw new Error(error.message);
    }

    const payouts = (data ?? []) as Payout[];
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const completed = payouts.filter((payout) => payout.status === "completed");
    const pending = payouts.filter(
      (payout) => payout.status === "pending" || payout.status === "processing",
    );
    const failed = payouts.filter((payout) => payout.status === "failed");
    const thisMonth = completed.filter((payout) => {
      const processedAt = payout.processed_at ? new Date(payout.processed_at) : null;
      return (
        processedAt &&
        processedAt.getMonth() === currentMonth &&
        processedAt.getFullYear() === currentYear
      );
    });

    return {
      totalEarned: roundMoney(
        completed.reduce((sum, payout) => sum + (payout.net_amount || payout.amount), 0),
      ),
      pendingPayouts: pending.length,
      pendingPayoutsAmount: roundMoney(
        pending.reduce((sum, payout) => sum + (payout.net_amount || payout.amount), 0),
      ),
      completedPayouts: completed.length,
      completedPayoutsAmount: roundMoney(
        completed.reduce((sum, payout) => sum + (payout.net_amount || payout.amount), 0),
      ),
      failedPayouts: failed.length,
      thisMonthEarned: roundMoney(
        thisMonth.reduce((sum, payout) => sum + (payout.net_amount || payout.amount), 0),
      ),
    };
  } catch (error) {
    console.error("getEarningsSummary failed:", error);
    return {
      totalEarned: 0,
      pendingPayouts: 0,
      pendingPayoutsAmount: 0,
      completedPayouts: 0,
      completedPayoutsAmount: 0,
      failedPayouts: 0,
      thisMonthEarned: 0,
    };
  }
}
