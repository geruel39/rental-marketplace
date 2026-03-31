import { NextResponse } from "next/server";

import { confirmPaymentFromWebhook } from "@/actions/bookings";
import { verifyWebhookSignature } from "@/lib/hitpay";
import { createAdminClient } from "@/lib/supabase/admin";

interface HitPayDebugBookingRecord {
  id: string;
  hitpay_payment_request_id: string | null;
  hitpay_payment_status: string | null;
  booking_status: string | null;
}

function getNestedRecord(
  value: unknown,
): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function getFirstString(
  sources: Array<Record<string, unknown> | null>,
  keys: string[],
) {
  for (const source of sources) {
    if (!source) {
      continue;
    }

    for (const key of keys) {
      const value = source[key];
      if (typeof value === "string" && value.length > 0) {
        return value;
      }
    }
  }

  return "";
}

function normalizeEventPayload(payload: Record<string, unknown>) {
  // Log the raw payload structure for debugging
  console.log("[WEBHOOK] Raw payload structure:", JSON.stringify(payload, null, 2));

  // HitPay may send different event formats - check various possibilities
  const eventKeys = ["event", "type", "event_type", "eventType"];
  let event = "";
  for (const key of eventKeys) {
    if (payload[key] && typeof payload[key] === "string") {
      event = payload[key] as string;
      console.log(`[WEBHOOK] Found event in key '${key}':`, event);
      break;
    }
  }

  // The data object may contain the actual payment details
  const data = payload.data && typeof payload.data === "object"
    ? (payload.data as Record<string, unknown>)
    : payload;
  const paymentRequest = getNestedRecord(data.payment_request);
  const order = getNestedRecord(data.order);
  const metadata = getNestedRecord(data.metadata);
  const relatable = getNestedRecord(data.relatable);
  const sources = [data, paymentRequest, order, metadata, relatable];

  // Check various status keys that HitPay might use
  const statusKeys = ["status", "payment_status", "state"];
  const status = getFirstString(sources, statusKeys);
  if (status) {
    console.log("[WEBHOOK] Found status:", status);
  }

  // Reference number may be in different places
  const refKeys = ["reference_number", "reference", "booking_id", "bookingId", "order_id"];
  const bookingId = getFirstString(sources, refKeys);
  if (bookingId) {
    console.log("[WEBHOOK] Found bookingId:", bookingId);
  }

  // Payment ID may be in different locations
  const paymentIdKeys = ["payment_id", "paymentId", "id", "transaction_id"];
  const paymentId = getFirstString(sources, paymentIdKeys);
  if (paymentId) {
    console.log("[WEBHOOK] Found paymentId:", paymentId);
  }

  return { event, bookingId, paymentId, status };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const debug = searchParams.get("debug");
  const testBookingId = searchParams.get("bookingId");
  
  if (debug === "1") {
    // Return diagnostic information
    return NextResponse.json({
      status: "Webhook endpoint is active",
      timestamp: new Date().toISOString(),
      hints: {
        testWith: "Send a POST request with valid HitPay signature",
        signatureHeaders: ["Hitpay-Signature", "x-hitpay-signature"],
        expectedEventTypes: ["payment_request.completed", "completed", "paid"],
      },
    });
  }
  
  // Test endpoint to check a specific booking's payment status
  if (testBookingId) {
    try {
      const admin = createAdminClient();
      const { data: booking, error } = await admin
        .from("bookings")
        .select(
          `id, 
           hitpay_payment_request_id, 
           hitpay_payment_status, 
           booking_status:status`,
        )
        .eq("id", testBookingId)
        .maybeSingle<HitPayDebugBookingRecord>();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      if (!booking) {
        return NextResponse.json({ error: "Booking not found" }, { status: 404 });
      }

      return NextResponse.json({
        bookingId: testBookingId,
        hitpay_payment_request_id: booking.hitpay_payment_request_id,
        hitpay_payment_status: booking.hitpay_payment_status,
        booking_status: booking.booking_status,
        note: "Use this payment_request_id to check HitPay dashboard",
      });
    } catch (err) {
      return NextResponse.json({ 
        error: err instanceof Error ? err.message : "Unknown error" 
      }, { status: 500 });
    }
  }
  
  return NextResponse.json({ success: true }, { status: 200 });
}

export async function HEAD() {
  return new NextResponse(null, { status: 200 });
}

export async function POST(request: Request) {
  console.log("[WEBHOOK] Received POST request");

  try {
    const signature =
      request.headers.get("Hitpay-Signature") ??
      request.headers.get("x-hitpay-signature") ??
      "";
    const contentType = request.headers.get("content-type") ?? "";
    const rawBody = await request.text();
    let payload: Record<string, string> = {};
    let jsonPayload: Record<string, unknown> = {};

    console.log("[WEBHOOK] Signature header:", signature ? "present" : "missing");
    console.log("[WEBHOOK] Content-Type:", contentType);
    console.log("[WEBHOOK] Raw body length:", rawBody.length);

    if (contentType.includes("application/json")) {
      const json = rawBody
        ? (JSON.parse(rawBody) as Record<string, unknown>)
        : {};
      jsonPayload = json;
      payload = Object.fromEntries(
        Object.entries(json).map(([key, value]) => [key, String(value ?? "")]),
      );
      console.log("[WEBHOOK] Parsed JSON payload keys:", Object.keys(json));
    } else {
      const formData = new URLSearchParams(rawBody);
      payload = Object.fromEntries(formData.entries());
      console.log("[WEBHOOK] Parsed form payload keys:", Object.keys(payload));
    }

    const fallbackSignature = payload.hmac ?? "";
    
    // Log signature verification details
    console.log("[WEBHOOK] Signature header present:", !!signature);
    console.log("[WEBHOOK] Fallback hmac present:", !!fallbackSignature);
    
    const headerSignatureValid = verifyWebhookSignature(rawBody, signature);
    const fallbackSignatureValid = fallbackSignature
      ? verifyWebhookSignature(payload, fallbackSignature)
      : false;
    const isValidSignature = headerSignatureValid || fallbackSignatureValid;

    console.log("[WEBHOOK] Header signature valid:", headerSignatureValid);
    console.log("[WEBHOOK] Fallback signature valid:", fallbackSignatureValid);

    if (!isValidSignature) {
      console.log("[WEBHOOK] Invalid signature - returning 401");
      console.log("[WEBHOOK] Hint: Check HITPAY_WEBHOOK_SALT environment variable");
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const normalizedPayload = contentType.includes("application/json")
      ? jsonPayload
      : (payload as Record<string, unknown>);
    const normalized = normalizeEventPayload(normalizedPayload);
    const isCompletedEvent =
      normalized.event?.includes("completed") ||
      normalized.event?.includes("paid") ||
      normalized.status === "completed" ||
      normalized.status === "succeeded" ||
      normalized.status === "paid";

    console.log("[WEBHOOK] Normalized event:", normalized.event);
    console.log("[WEBHOOK] Normalized status:", normalized.status);
    console.log("[WEBHOOK] Normalized bookingId:", normalized.bookingId);
    console.log("[WEBHOOK] Is completed event:", isCompletedEvent);

    if (isCompletedEvent && normalized.bookingId) {
      console.log("[WEBHOOK] Processing completed payment for booking:", normalized.bookingId);
      const bookingId = normalized.bookingId;
      const result = await confirmPaymentFromWebhook(
        bookingId,
        normalized.paymentId || undefined,
      );

      if (result.error) {
        console.log("[WEBHOOK] Error confirming payment:", result.error);
        return NextResponse.json({ error: result.error }, { status: 500 });
      }

      console.log("[WEBHOOK] Webhook processing completed successfully");
    } else {
      console.log("[WEBHOOK] Skipping processing: not a completed event or no bookingId");
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("[WEBHOOK] Error processing webhook:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Webhook processing failed",
      },
      { status: 500 },
    );
  }
}
