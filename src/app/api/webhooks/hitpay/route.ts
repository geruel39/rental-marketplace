import { NextResponse } from "next/server";

import { verifyWebhookSignature } from "@/lib/hitpay";
import { createAdminClient } from "@/lib/supabase/admin";

interface WebhookBookingRecord {
  id: string;
  renter_id: string;
  lister_id: string;
  listing_id: string;
  listing: { title: string } | Array<{ title: string }> | null;
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

  // Check various status keys that HitPay might use
  const statusKeys = ["status", "payment_status", "state"];
  let status = "";
  for (const key of statusKeys) {
    if (data[key] && typeof data[key] === "string") {
      status = data[key] as string;
      console.log(`[WEBHOOK] Found status in key '${key}':`, status);
      break;
    }
  }

  // Reference number may be in different places
  const refKeys = ["reference_number", "reference", "booking_id", "order_id"];
  let bookingId = "";
  for (const key of refKeys) {
    if (data[key] && typeof data[key] === "string") {
      bookingId = data[key] as string;
      console.log(`[WEBHOOK] Found bookingId in key '${key}':`, bookingId);
      break;
    }
  }

  // Payment ID may be in different locations
  const paymentIdKeys = ["payment_id", "paymentId", "id", "transaction_id"];
  let paymentId = "";
  for (const key of paymentIdKeys) {
    if (data[key] && typeof data[key] === "string") {
      paymentId = data[key] as string;
      console.log(`[WEBHOOK] Found paymentId in key '${key}':`, paymentId);
      break;
    }
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
           status as booking_status`,
        )
        .eq("id", testBookingId)
        .maybeSingle();

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

    console.log("[WEBHOOK] Signature header:", signature ? "present" : "missing");
    console.log("[WEBHOOK] Content-Type:", contentType);
    console.log("[WEBHOOK] Raw body length:", rawBody.length);

    if (contentType.includes("application/json")) {
      const json = rawBody
        ? (JSON.parse(rawBody) as Record<string, unknown>)
        : {};
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
    
    const isValidSignature = verifyWebhookSignature(rawBody, signature);

    console.log("[WEBHOOK] Header signature valid:", headerValid);
    console.log("[WEBHOOK] Fallback signature valid:", fallbackValid);

    if (!isValidSignature) {
      console.log("[WEBHOOK] Invalid signature - returning 401");
      console.log("[WEBHOOK] Hint: Check HITPAY_WEBHOOK_SALT environment variable");
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const jsonPayload = contentType.includes("application/json") && rawBody
      ? (JSON.parse(rawBody) as Record<string, unknown>)
      : {};
    const normalized = normalizeEventPayload(jsonPayload);
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

      const admin = createAdminClient();
      const bookingId = normalized.bookingId;

      const { data: booking, error: bookingError } = await admin
        .from("bookings")
        .select(
          `
            id,
            renter_id,
            lister_id,
            listing_id
          `,
        )
        .eq("id", bookingId)
        .maybeSingle<WebhookBookingRecord>();

      if (bookingError || !booking) {
        console.log("[WEBHOOK] Booking not found or error:", bookingError?.message);
        return NextResponse.json({ error: "Booking not found" }, { status: 404 });
      }

      console.log("[WEBHOOK] Updating booking status to completed");

      const { error: updateError } = await admin
        .from("bookings")
        .update({
          hitpay_payment_id: normalized.paymentId || null,
          hitpay_payment_status: "completed",
          paid_at: new Date().toISOString(),
          status: "active",
        })
        .eq("id", bookingId);

      if (updateError) {
        console.log("[WEBHOOK] Error updating booking:", updateError.message);
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }

      console.log("[WEBHOOK] Sending notifications");

      await admin.from("notifications").insert([
        {
          user_id: booking.lister_id,
          type: "payment_received",
          title: `Payment received`,
          booking_id: bookingId,
          listing_id: booking.listing_id,
          from_user_id: booking.renter_id,
          body: "The renter has completed payment.",
          action_url: "/dashboard/requests?status=active",
        },
        {
          user_id: booking.renter_id,
          type: "payment_confirmed",
          title: "Payment confirmed",
          booking_id: bookingId,
          listing_id: booking.listing_id,
          from_user_id: booking.lister_id,
          body: `Your payment has been confirmed.`,
          action_url: "/dashboard/my-rentals?status=active",
        },
      ]);

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
