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
  const event = typeof payload.event === "string" ? payload.event : "";
  const data =
    payload.data && typeof payload.data === "object"
      ? (payload.data as Record<string, unknown>)
      : payload;

  return {
    event,
    bookingId:
      typeof data.reference_number === "string"
        ? data.reference_number
        : typeof payload.reference_number === "string"
          ? payload.reference_number
          : "",
    paymentId:
      typeof data.payment_id === "string"
        ? data.payment_id
        : typeof payload.payment_id === "string"
          ? payload.payment_id
          : "",
    status:
      typeof data.status === "string"
        ? data.status
        : typeof payload.status === "string"
          ? payload.status
          : "",
  };
}

export async function GET() {
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
    const isValidSignature =
      verifyWebhookSignature(rawBody, signature) ||
      verifyWebhookSignature(payload, fallbackSignature);

    console.log("[WEBHOOK] Signature validation:", isValidSignature ? "valid" : "invalid");

    if (!isValidSignature) {
      console.log("[WEBHOOK] Invalid signature, returning 401");
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const jsonPayload = contentType.includes("application/json") && rawBody
      ? (JSON.parse(rawBody) as Record<string, unknown>)
      : {};
    const normalized = normalizeEventPayload(jsonPayload);
    const isCompletedEvent =
      normalized.event === "payment_request.completed" ||
      normalized.status === "completed" ||
      normalized.status === "succeeded";

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
