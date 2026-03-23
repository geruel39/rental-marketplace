"use server";

import { getAppUrl } from "@/lib/env";
import { createPaymentRequest, getPaymentStatus } from "@/lib/hitpay";
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
      .select("hitpay_payment_request_id")
      .eq("id", bookingId)
      .maybeSingle<{ hitpay_payment_request_id: string | null }>();

    if (error || !booking?.hitpay_payment_request_id) {
      return { error: "Payment request not found" };
    }

    const payment = await getPaymentStatus(booking.hitpay_payment_request_id);
    return { status: payment.status };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Failed to check payment status",
    };
  }
}
