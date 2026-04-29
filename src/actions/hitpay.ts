"use server";

import { getPaymentStatus } from "@/lib/hitpay";
import { createClient } from "@/lib/supabase/server";
import { createPaymentForBooking as createBookingPaymentRequest } from "@/actions/payments";

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
  hitpay_payment_url?: string | null;
  hitpay_payment_status?: string | null;
}

export async function createPaymentForBooking(
  bookingId: string,
): Promise<{ paymentUrl: string } | { error: string }> {
  const result = await createBookingPaymentRequest(bookingId);
  if ("error" in result) {
    return result;
  }

  return { paymentUrl: result.paymentUrl };
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
    console.log("[PAYMENT_STATUS] Returning read-only status. Booking updates must come from webhook processing.");

    return { status: payment.status };
  } catch (error) {
    console.error("[PAYMENT_STATUS] Error checking payment status:", error);
    return {
      error: "Could not verify payment status. Please try again.",
    };
  }
}
