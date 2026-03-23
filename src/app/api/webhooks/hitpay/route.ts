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

async function parsePayload(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    const json = (await request.json()) as Record<string, unknown>;
    return Object.fromEntries(
      Object.entries(json).map(([key, value]) => [key, String(value ?? "")]),
    );
  }

  const formData = await request.formData();
  return Object.fromEntries(
    Array.from(formData.entries()).map(([key, value]) => [key, String(value)]),
  );
}

export async function GET() {
  return NextResponse.json({ success: true }, { status: 200 });
}

export async function HEAD() {
  return new NextResponse(null, { status: 200 });
}

export async function POST(request: Request) {
  try {
    const payload = await parsePayload(request);
    const signature = payload.hmac ?? "";

    if (!verifyWebhookSignature(payload, signature)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    if (payload.status === "completed") {
      const admin = createAdminClient();
      const bookingId = payload.reference_number;

      const { data: booking, error: bookingError } = await admin
        .from("bookings")
        .select(
          `
            id,
            renter_id,
            lister_id,
            listing_id,
            listing:listings!bookings_listing_id_fkey(title)
          `,
        )
        .eq("id", bookingId)
        .maybeSingle<WebhookBookingRecord>();

      if (bookingError || !booking) {
        return NextResponse.json({ error: "Booking not found" }, { status: 404 });
      }

      const listing = Array.isArray(booking.listing)
        ? booking.listing[0]
        : booking.listing;

      if (!listing?.title) {
        return NextResponse.json(
          { error: "Booking is missing listing details" },
          { status: 400 },
        );
      }

      const { error: updateError } = await admin
        .from("bookings")
        .update({
          hitpay_payment_id: payload.payment_id,
          hitpay_payment_status: "completed",
          paid_at: new Date().toISOString(),
          status: "active",
        })
        .eq("id", bookingId);

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }

      await admin.from("notifications").insert([
        {
          user_id: booking.lister_id,
          type: "payment_received",
          title: `Payment received for ${listing.title}`,
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
          body: `Your payment for ${listing.title} has been confirmed.`,
          action_url: "/dashboard/my-rentals?status=active",
        },
      ]);
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Webhook processing failed",
      },
      { status: 500 },
    );
  }
}
