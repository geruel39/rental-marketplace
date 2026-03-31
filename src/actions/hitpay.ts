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
  renter_id?: string;
  lister_id?: string;
  listing_id?: string;
  hitpay_payment_request_id?: string | null;
  hitpay_payment_status?: string | null;
}

function extractPaymentId(payments: Record<string, unknown>[]) {
  const firstPayment = payments[0];

  if (!firstPayment) {
    return undefined;
  }

  if (typeof firstPayment.id === "string" && firstPayment.id.length > 0) {
    return firstPayment.id;
  }

  if (
    typeof firstPayment.payment_id === "string" &&
    firstPayment.payment_id.length > 0
  ) {
    return firstPayment.payment_id;
  }

  return undefined;
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
      console.error("createPaymentForBooking booking update failed:", updateError);
      return { error: "Could not create the payment link. Please try again." };
    }

    return { paymentUrl: payment.url };
  } catch (error) {
    console.error("createPaymentForBooking failed:", error);
    return {
      error: "Something went wrong. Please try again.",
    };
  }
}

export async function checkPaymentStatus(
  bookingId: string,
): Promise<{ status: string } | { error: string }> {
  console.log("[PAYMENT_STATUS] Checking status for booking:", bookingId);

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
      console.log("[PAYMENT_STATUS] Booking not found or no payment request ID:", error?.message);
      return { error: "Payment request not found" };
    }

    console.log("[PAYMENT_STATUS] Current DB status:", booking.hitpay_payment_status);

    if (booking.hitpay_payment_status === "completed") {
      console.log("[PAYMENT_STATUS] Already completed in DB");
      return { status: "completed" };
    }

    console.log("[PAYMENT_STATUS] Fetching status from HitPay API for request:", booking.hitpay_payment_request_id);

    const payment = await getPaymentStatus(booking.hitpay_payment_request_id);

    console.log("[PAYMENT_STATUS] HitPay API status:", payment.status);
    console.log("[PAYMENT_STATUS] Payment payments array:", payment.payments);

    // Check for various completed status values
    const completedStatuses = ["completed", "succeeded", "paid", "success"];
    const isCompleted = completedStatuses.includes(payment.status.toLowerCase());
    
    if (isCompleted) {
      console.log("[PAYMENT_STATUS] Payment is completed, confirming booking");
      const { confirmPayment } = await import("@/actions/bookings");
      const result = await confirmPayment(
        booking.id,
        extractPaymentId(payment.payments),
      );
      if (result.error) {
        console.log("[PAYMENT_STATUS] Error confirming payment:", result.error);
        return { error: result.error };
      }
    } else {
      console.log("[PAYMENT_STATUS] Payment not yet completed, status is:", payment.status);
    }

    return { status: payment.status };
  } catch (error) {
    console.error("[PAYMENT_STATUS] Error checking payment status:", error);
    return {
      error: "Could not verify payment status. Please try again.",
    };
  }
}
