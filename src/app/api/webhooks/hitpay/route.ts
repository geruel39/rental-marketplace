import crypto from "node:crypto";

import { NextRequest, NextResponse } from "next/server";

import { handleCompletedCheckoutPayment, handlePaymentConfirmed } from "@/actions/payments";
import { getAdminIds, sendNotification } from "@/lib/notifications";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

type HitPayWebhookPayload = {
  payment_id: string;
  payment_request_id: string;
  phone: string;
  amount: string;
  currency: string;
  status: string;
  reference_number: string;
};

type BookingSnapshot = {
  id: string;
  renter_id: string;
  lister_id: string;
  listing_id: string;
  status: string;
  hitpay_payment_request_id: string | null;
  instant_book: boolean;
};

type TransactionSnapshot = {
  id: string;
  booking_id: string | null;
  status: string;
  hitpay_payment_request_id: string | null;
};

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function getBookingLockKey(bookingId: string) {
  const digest = crypto.createHash("sha256").update(bookingId).digest("hex");
  return BigInt(`0x${digest.slice(0, 15)}`).toString();
}

async function tryAcquireBookingLock(bookingId: string) {
  const adminClient = createAdminClient();
  const lockKey = getBookingLockKey(bookingId);
  const attempts = [
    { p_lock_key: lockKey },
    { lock_key: lockKey },
  ];

  for (const args of attempts) {
    const { data, error } = await adminClient.rpc(
      "try_acquire_booking_webhook_lock",
      args,
    );

    if (!error) {
      return Boolean(data);
    }
  }

  console.error(
    "[HITPAY_WEBHOOK] Booking advisory lock RPC unavailable; continuing with idempotency safeguards only.",
  );
  return true;
}

function verifyHitPaySignature(
  payload: Record<string, string>,
  receivedHmac: string,
): boolean {
  const salt = process.env.HITPAY_WEBHOOK_SALT;
  if (!salt) {
    console.error("[HITPAY_WEBHOOK] HITPAY_WEBHOOK_SALT not configured");
    return false;
  }

  const normalizedHmac = receivedHmac.trim().toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(normalizedHmac)) {
    return false;
  }

  const message = Object.keys(payload)
    .sort((a, b) => a.localeCompare(b))
    .map((key) => key + payload[key])
    .join("");

  const computed = crypto
    .createHmac("sha256", salt)
    .update(message)
    .digest("hex");

  try {
    return crypto.timingSafeEqual(
      Buffer.from(computed, "hex"),
      Buffer.from(normalizedHmac, "hex"),
    );
  } catch {
    return false;
  }
}

function parseWebhookBody(rawBody: string) {
  const params = new URLSearchParams(rawBody);
  const payload: Record<string, string> = {};

  for (const key of new Set(params.keys())) {
    const allValues = params.getAll(key);
    if (allValues.length !== 1) {
      throw new Error(`Duplicate webhook field: ${key}`);
    }

    payload[key] = allValues[0] ?? "";
  }

  return payload;
}

function getRequiredField(
  payload: Record<string, string>,
  key: keyof HitPayWebhookPayload,
) {
  const value = payload[key];
  return typeof value === "string" ? value.trim() : "";
}

async function notifyAdmins(params: {
  bookingId: string;
  title: string;
  body: string;
  actionUrl?: string;
}) {
  const adminIds = await getAdminIds();

  if (adminIds.length === 0) {
    return;
  }

  await Promise.all(
    adminIds.map((userId) =>
      sendNotification({
        userId,
        type: "admin_alert",
        title: params.title,
        body: params.body,
        bookingId: params.bookingId,
        actionUrl: params.actionUrl ?? `/admin/bookings/${params.bookingId}`,
      }),
    ),
  );
}

async function addTimelineEntry(params: {
  bookingId: string;
  status: string;
  previousStatus?: string;
  title: string;
  description?: string;
  metadata?: Record<string, unknown>;
}) {
  const adminClient = createAdminClient();
  const payload = {
    booking_id: params.bookingId,
    status: params.status,
    previous_status: params.previousStatus ?? null,
    actor_id: null,
    actor_role: "system",
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
    const { error } = await adminClient.rpc("add_booking_timeline", args);
    if (!error) {
      return;
    }
  }

  const { error } = await adminClient.from("booking_timeline").insert(payload);
  if (error) {
    console.error("[HITPAY_WEBHOOK] Failed to add timeline entry:", error);
  }
}

async function fetchBooking(bookingId: string) {
  const adminClient = createAdminClient();
  const { data, error } = await adminClient
    .from("bookings")
    .select(
      `
        id,
        renter_id,
        lister_id,
        listing_id,
        status,
        hitpay_payment_request_id,
        listing:listings!bookings_listing_id_fkey(instant_book)
      `,
    )
    .eq("id", bookingId)
    .maybeSingle<
      Omit<BookingSnapshot, "instant_book"> & {
        listing:
          | { instant_book: boolean }
          | Array<{ instant_book: boolean }>
          | null;
      }
    >();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    return null;
  }

  const listing = Array.isArray(data.listing) ? data.listing[0] : data.listing;

  return {
    ...data,
    instant_book: listing?.instant_book ?? false,
  };
}

async function fetchTransaction(transactionId: string) {
  const adminClient = createAdminClient();
  const { data, error } = await adminClient
    .from("transactions")
    .select("id, booking_id, status, hitpay_payment_request_id")
    .eq("id", transactionId)
    .maybeSingle<TransactionSnapshot>();

  if (error) {
    throw new Error(error.message);
  }

  return data ?? null;
}

async function markWebhookReceipt(params: {
  bookingId: string;
  paymentId: string;
  paymentRequestId: string;
  status: string;
  timestamp: string;
}) {
  const adminClient = createAdminClient();
  const { error } = await adminClient
    .from("bookings")
    .update({
      hitpay_payment_id: params.paymentId || null,
      hitpay_payment_request_id: params.paymentRequestId || null,
      hitpay_payment_status: params.status,
      last_webhook_at: params.timestamp,
      updated_at: params.timestamp,
    })
    .eq("id", params.bookingId);

  if (error) {
    console.error("[HITPAY_WEBHOOK] Failed to mark webhook receipt:", error);
  }
}

async function handleFailedPayment(params: {
  booking: BookingSnapshot;
  bookingId: string;
  paymentId: string;
  paymentRequestId: string;
  amount: number;
  currency: string;
  status: string;
  timestamp: string;
}) {
  const adminClient = createAdminClient();
  const idempotencyKey = `payment_failed_${params.paymentRequestId || params.paymentId || params.bookingId}`;

  const { data: existingFailure, error: existingFailureError } = await adminClient
    .from("transactions")
    .select("id")
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle<{ id: string }>();

  if (existingFailureError) {
    console.error(
      "[HITPAY_WEBHOOK] Failed to check failed-payment idempotency:",
      existingFailureError,
    );
  }

  if (!existingFailure) {
    const { error: transactionError } = await adminClient
      .from("transactions")
      .insert({
        booking_id: params.bookingId,
        renter_id: params.booking.renter_id,
        lister_id: params.booking.lister_id,
        event_type: "payment_failed",
        gross_amount: params.amount,
        hitpay_fee: 0,
        platform_fee: 0,
        net_amount: 0,
        currency: params.currency,
        hitpay_payment_request_id: params.paymentRequestId,
        hitpay_payment_id: params.paymentId,
        status: "failed",
        failure_reason: `HitPay reported payment status: ${params.status}`,
        idempotency_key: idempotencyKey,
        triggered_by_role: "system",
        processed_at: params.timestamp,
        metadata: {
          source: "webhook",
          hitpay_status: params.status,
          received_at: params.timestamp,
        },
      });

    if (transactionError) {
      console.error(
        "[HITPAY_WEBHOOK] Failed to insert failed payment transaction:",
        transactionError,
      );
    }

    await addTimelineEntry({
      bookingId: params.bookingId,
      status: params.booking.status,
      previousStatus: params.booking.status,
      title: "Payment failed",
      description: "HitPay reported that the payment could not be completed.",
      metadata: {
        amount: params.amount,
        currency: params.currency,
        hitpay_payment_id: params.paymentId,
        hitpay_payment_request_id: params.paymentRequestId,
        hitpay_status: params.status,
      },
    });

    await sendNotification({
      userId: params.booking.renter_id,
      type: "payment_failed",
      title: "Payment failed",
      body: "Your payment could not be processed. Please try again.",
      actionUrl: `/dashboard/bookings/${params.bookingId}`,
      bookingId: params.bookingId,
    });
  }
}

export async function GET() {
  return NextResponse.json({ success: true }, { status: 200 });
}

export async function HEAD() {
  return new NextResponse(null, { status: 200 });
}

export async function POST(request: NextRequest) {
  const receivedAt = new Date().toISOString();

  try {
    console.log("=== HITPAY WEBHOOK RECEIVED ===");
    console.log("Timestamp:", receivedAt);

    const rawBody = await request.text();
    console.log("Raw body:", rawBody);
    const payload = parseWebhookBody(rawBody);

    const { hmac, ...payloadWithoutHmac } = payload;
    console.log("Parsed payload:", {
      payment_request_id: payload.payment_request_id ?? null,
      payment_id: payload.payment_id ?? null,
      status: payload.status ?? null,
      reference_number: payload.reference_number ?? null,
      amount: payload.amount ?? null,
    });

    console.log("[HITPAY_WEBHOOK] Webhook received:", {
      payment_request_id: payload.payment_request_id ?? null,
      status: payload.status ?? null,
      reference_number: payload.reference_number ?? null,
      received_at: receivedAt,
    });

    if (!hmac) {
      console.error("[HITPAY_WEBHOOK] Missing HMAC signature");
      return NextResponse.json({ error: "Missing signature" }, { status: 401 });
    }

    if (!verifyHitPaySignature(payloadWithoutHmac, hmac)) {
      console.error("[HITPAY_WEBHOOK] HMAC verification failed", {
        received_hmac: hmac,
        payload_keys: Object.keys(payloadWithoutHmac).sort(),
      });
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const paymentId = getRequiredField(payload, "payment_id");
    const paymentRequestId = getRequiredField(payload, "payment_request_id");
    const amountRaw = getRequiredField(payload, "amount");
    const currency = getRequiredField(payload, "currency") || "SGD";
    const status = getRequiredField(payload, "status").toLowerCase();
    const bookingId = getRequiredField(payload, "reference_number");

    if (!bookingId || !paymentRequestId || !status) {
      console.error("[HITPAY_WEBHOOK] Missing required fields:", {
        bookingId,
        paymentRequestId,
        status,
      });
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    const parsedAmount = roundMoney(Number(amountRaw));
    if (!Number.isFinite(parsedAmount) || parsedAmount < 0) {
      console.error("[HITPAY_WEBHOOK] Invalid amount:", {
        bookingId,
        amount: amountRaw,
      });
      return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
    }

    const checkout = await fetchTransaction(bookingId);
    if (checkout) {
      console.log("Found checkout transaction:", checkout);

      if (status === "completed") {
        const createdBookingId = await handleCompletedCheckoutPayment({
          checkoutId: checkout.id,
          hitpayPaymentId: paymentId,
          hitpayPaymentRequestId: paymentRequestId,
          amount: parsedAmount,
          currency,
        });

        return NextResponse.json(
          { received: true, bookingId: createdBookingId },
          { status: 200 },
        );
      }

      return NextResponse.json({ received: true, note: "checkout_status_ignored" }, { status: 200 });
    }

    console.log("Looking for booking:", bookingId);
    const booking = await fetchBooking(bookingId);
    console.log("Found booking:", booking
      ? {
          id: booking.id,
          status: booking.status,
          hitpay_payment_request_id: booking.hitpay_payment_request_id,
          instant_book: booking.instant_book,
        }
      : null);
    if (!booking) {
      console.error("[HITPAY_WEBHOOK] Booking not found:", bookingId);
      await notifyAdmins({
        bookingId,
        title: "Verified HitPay webhook for missing booking",
        body: `HitPay sent a verified ${status} webhook for reference ${bookingId}, but no booking row or checkout transaction was found.`,
      });
      return NextResponse.json(
        { received: true, note: "reference_not_found" },
        { status: 200 },
      );
    }

    await markWebhookReceipt({
      bookingId,
      paymentId,
      paymentRequestId,
      status,
      timestamp: receivedAt,
    });

    if (status === "completed") {
      const lockAcquired = await tryAcquireBookingLock(bookingId);
      if (!lockAcquired) {
        console.log("[HITPAY_WEBHOOK] Booking lock not acquired; skipping duplicate in-flight webhook", {
          bookingId,
        });
        return NextResponse.json(
          { received: true, note: "lock_not_acquired" },
          { status: 200 },
        );
      }

      const idempotencyKey = `payment_confirmed_${bookingId}`;
      const adminClient = createAdminClient();
      const { data: existingTransaction, error: transactionLookupError } = await adminClient
        .from("transactions")
        .select("id, status")
        .eq("idempotency_key", idempotencyKey)
        .maybeSingle<{ id: string; status: string }>();

      if (transactionLookupError) {
        console.error(
          "[HITPAY_WEBHOOK] Failed to check completed payment idempotency:",
          transactionLookupError,
        );
      }

      if (existingTransaction?.status === "completed") {
        return NextResponse.json(
          { received: true, note: "already_processed" },
          { status: 200 },
        );
      }

      if (!["lister_confirmation", "confirmed"].includes(booking.status)) {
        console.log("[HITPAY_WEBHOOK] Ignoring completed webhook for booking status:", {
          bookingId,
          bookingStatus: booking.status,
        });
        return NextResponse.json(
          { received: true, note: "ignored_for_status" },
          { status: 200 },
        );
      }

      await handlePaymentConfirmed({
        hitpayPaymentId: paymentId,
        hitpayPaymentRequestId: paymentRequestId,
        bookingId,
        amount: parsedAmount,
        currency,
      });

      const verificationClient = createAdminClient();
      const [bookingResult, transactionResult] = await Promise.all([
        verificationClient
          .from("bookings")
          .select("status, hitpay_payment_status, paid_at")
          .eq("id", bookingId)
          .maybeSingle<{
            status: string;
            hitpay_payment_status: string | null;
            paid_at: string | null;
          }>(),
        verificationClient
          .from("transactions")
          .select("status")
          .eq("idempotency_key", idempotencyKey)
          .maybeSingle<{ status: string }>(),
      ]);

      const bookingAfter = bookingResult.data;
      const transactionAfter = transactionResult.data;
      const expectedStatus = booking.instant_book ? "confirmed" : "lister_confirmation";
      const completedSuccessfully =
        bookingAfter?.status === expectedStatus &&
        bookingAfter.hitpay_payment_status === "completed" &&
        Boolean(bookingAfter.paid_at) &&
        transactionAfter?.status === "completed";

      if (!completedSuccessfully) {
        console.error("[HITPAY_WEBHOOK] Payment confirmation did not fully persist:", {
          bookingId,
          bookingStatus: bookingAfter?.status ?? null,
          paymentStatus: bookingAfter?.hitpay_payment_status ?? null,
          transactionStatus: transactionAfter?.status ?? null,
        });

        await notifyAdmins({
          bookingId,
          title: "HitPay payment needs manual review",
          body: `Verified completed payment webhook for booking ${bookingId} did not finish all persistence checks. Review immediately.`,
        });

        return NextResponse.json(
          { received: true, note: "manual_review_required" },
          { status: 200 },
        );
      }

      return NextResponse.json({ received: true }, { status: 200 });
    }

    if (status === "failed") {
      await handleFailedPayment({
        booking,
        bookingId,
        paymentId,
        paymentRequestId,
        amount: parsedAmount,
        currency,
        status,
        timestamp: receivedAt,
      });

      return NextResponse.json({ received: true }, { status: 200 });
    }

    console.log("[HITPAY_WEBHOOK] Ignoring unsupported status:", {
      bookingId,
      status,
    });

    return NextResponse.json(
      { received: true, note: "ignored_status" },
      { status: 200 },
    );
  } catch (error) {
    console.error("[HITPAY_WEBHOOK] Error processing webhook:", error);
    return NextResponse.json(
      { received: true, note: "processing_error" },
      { status: 200 },
    );
  }
}
