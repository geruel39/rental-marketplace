"use server";

import { getAppUrl } from "@/lib/env";
import { createPaymentRequest, getPaymentStatus } from "@/lib/hitpay";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

interface PaymentBookingRecord {
  id: string;
  total_price: number;
  renter:
    | {
        email: string;
        display_name: string | null;
        full_name: string | null;
      }
    | Array<{
        email: string;
        display_name: string | null;
        full_name: string | null;
      }>
    | null;
  listing:
    | { title: string }
    | Array<{ title: string }>
    | null;
  renter_id?: string;
  lister_id?: string;
  listing_id?: string;
  hitpay_payment_request_id?: string | null;
  hitpay_payment_status?: string | null;
}

async function markBookingPaid(
  booking: PaymentBookingRecord,
): Promise<{ error?: string }> {
  if (!booking.renter_id || !booking.lister_id || !booking.listing_id) {
    return { error: "Booking is missing ownership details" };
  }

  const listing = Array.isArray(booking.listing) ? booking.listing[0] : booking.listing;

  if (!listing?.title) {
    return { error: "Booking is missing listing details" };
  }

  const admin = createAdminClient();
  const { error: updateError } = await admin
    .from("bookings")
    .update({
      hitpay_payment_status: "completed",
      paid_at: new Date().toISOString(),
      status: "active",
    })
    .eq("id", booking.id)
    .neq("hitpay_payment_status", "completed");

  if (updateError) {
    return { error: updateError.message };
  }

  await admin.from("notifications").insert([
    {
      user_id: booking.lister_id,
      type: "payment_received",
      title: `Payment received for ${listing.title}`,
      booking_id: booking.id,
      listing_id: booking.listing_id,
      from_user_id: booking.renter_id,
      body: "The renter has completed payment.",
      action_url: "/dashboard/requests?status=active",
    },
    {
      user_id: booking.renter_id,
      type: "payment_confirmed",
      title: "Payment confirmed",
      booking_id: booking.id,
      listing_id: booking.listing_id,
      from_user_id: booking.lister_id,
      body: `Your payment for ${listing.title} has been confirmed.`,
      action_url: "/dashboard/my-rentals?status=active",
    },
  ]);

  return {};
}

export async function createPaymentForBooking(
  bookingId: string,
): Promise<{ paymentUrl: string } | { error: string }> {
  try {
    const supabase = await createClient();
    const { data: booking, error } = await supabase
      .from("bookings")
      .select(
        `
          id,
          total_price,
          renter:profiles!bookings_renter_id_fkey(email, display_name, full_name),
          listing:listings!bookings_listing_id_fkey(title)
        `,
      )
      .eq("id", bookingId)
      .maybeSingle<PaymentBookingRecord>();

    if (error || !booking) {
      return { error: "Booking not found" };
    }

    const renter = Array.isArray(booking.renter)
      ? booking.renter[0]
      : booking.renter;
    const listing = Array.isArray(booking.listing)
      ? booking.listing[0]
      : booking.listing;

    if (!renter?.email || !listing?.title) {
      return { error: "Booking is missing renter or listing details" };
    }

    const appUrl = getAppUrl();
    const payment = await createPaymentRequest({
      amount: Number(booking.total_price),
      currency: "SGD",
      email: renter.email,
      name: renter.display_name || renter.full_name || renter.email,
      purpose: `Rental: ${listing.title}`.slice(0, 100),
      reference_number: bookingId,
      redirect_url: `${appUrl}/payment/success?booking=${bookingId}`,
      webhook: `${appUrl}/api/webhooks/hitpay`,
    });

    const { error: updateError } = await supabase
      .from("bookings")
      .update({
        hitpay_payment_request_id: payment.id,
        hitpay_payment_url: payment.url,
        hitpay_payment_status: payment.status,
      })
      .eq("id", bookingId);

    if (updateError) {
      return { error: updateError.message };
    }

    return { paymentUrl: payment.url };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Failed to create payment",
    };
  }
}

export async function checkPaymentStatus(
  bookingId: string,
): Promise<{ status: string } | { error: string }> {
  try {
    const supabase = await createClient();
    const { data: booking, error } = await supabase
      .from("bookings")
      .select(
        `
          id,
          renter_id,
          lister_id,
          listing_id,
          hitpay_payment_request_id,
          hitpay_payment_status,
          renter:profiles!bookings_renter_id_fkey(email, display_name, full_name),
          listing:listings!bookings_listing_id_fkey(title)
        `,
      )
      .eq("id", bookingId)
      .maybeSingle<PaymentBookingRecord>();

    if (error || !booking?.hitpay_payment_request_id) {
      return { error: "Payment request not found" };
    }

    if (booking.hitpay_payment_status === "completed") {
      return { status: "completed" };
    }

    const payment = await getPaymentStatus(booking.hitpay_payment_request_id);

    if (payment.status === "completed") {
      const result = await markBookingPaid(booking);
      if (result.error) {
        return { error: result.error };
      }
    }

    return { status: payment.status };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Failed to check payment status",
    };
  }
}
