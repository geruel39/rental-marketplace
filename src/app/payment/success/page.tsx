import Link from "next/link";
import { CheckCircle2, Loader2, TriangleAlert } from "lucide-react";

import { getBookingDetails } from "@/actions/bookings";
import {
  getCheckoutStatusForSuccessPage,
  getFeeConfig,
  reconcileCheckoutPayment,
  reconcilePendingBookingPayment,
} from "@/actions/payments";
import { PaymentBreakdownCard } from "@/components/payments/payment-breakdown-card";
import { PaymentStatusPoller } from "@/components/payments/payment-status-poller";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { calculatePaymentBreakdown } from "@/lib/utils";

type SearchParams = Record<string, string | string[] | undefined>;

interface PaymentSuccessPageProps {
  searchParams: Promise<SearchParams>;
}

function getSingleValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function getRefundPolicyMessage(policy?: string | null) {
  switch (policy) {
    case "flexible":
      return "You can cancel for a full refund within 24 hours.";
    case "moderate":
      return "You can cancel for a full refund within 72 hours.";
    case "strict":
      return "You can cancel for a full refund within 168 hours.";
    default:
      return "You can cancel for a full refund within the applicable listing policy window.";
  }
}

export default async function PaymentSuccessPage({
  searchParams,
}: PaymentSuccessPageProps) {
  const resolvedSearchParams = await searchParams;
  const bookingId = getSingleValue(resolvedSearchParams.booking);
  const checkoutId = getSingleValue(resolvedSearchParams.checkout);
  let checkout = checkoutId ? await getCheckoutStatusForSuccessPage(checkoutId) : null;

  if (checkoutId && checkout && !checkout.bookingId) {
    const reconciledBookingId = await reconcileCheckoutPayment(checkoutId);
    if (reconciledBookingId) {
      checkout = await getCheckoutStatusForSuccessPage(checkoutId);
    }
  }

  const resolvedBookingId = bookingId ?? checkout?.bookingId ?? undefined;
  if (resolvedBookingId) {
    await reconcilePendingBookingPayment(resolvedBookingId);
  }
  const booking = resolvedBookingId ? await getBookingDetails(resolvedBookingId) : null;

  if (!resolvedBookingId && !checkout) {
    return (
      <main className="mx-auto flex min-h-[70vh] max-w-3xl items-center px-4 py-12 sm:px-6 lg:px-8">
        <Card className="w-full border-border/70">
          <CardHeader className="text-center">
            <TriangleAlert className="mx-auto size-12 text-amber-600" />
            <CardTitle className="text-2xl">Booking not found</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 text-center">
            <p className="text-sm text-muted-foreground">
              We could not find the booking linked to this payment.
            </p>
            <Button asChild>
              <Link href="/dashboard/my-rentals">Go to My Rentals</Link>
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  if (!booking) {
    return (
      <main className="mx-auto flex min-h-[70vh] max-w-5xl items-center px-4 py-12 sm:px-6 lg:px-8">
        <PaymentStatusPoller
          enabled
          fallbackMessage="Payment is being verified. Your booking will appear once the webhook finishes creating it."
        />
        <Card className="w-full border-border/70">
          <CardHeader className="text-center">
            <Loader2 className="mx-auto size-12 animate-spin text-amber-500" />
            <CardTitle className="text-2xl">Processing your payment...</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 text-center">
            <p className="text-sm text-muted-foreground">
              Your payment redirect was received. We are waiting for the payment webhook to finalize your booking.
            </p>
            <div className="flex justify-center">
              <Button asChild variant="outline">
                <Link href="/renter/rentals">Check My Rentals</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    );
  }

  const fees = await getFeeConfig();
  const breakdown = calculatePaymentBreakdown({
    subtotal: booking.subtotal,
    depositAmount: booking.deposit_amount,
    pricingPeriod: booking.pricing_period,
    fees,
  });

  if (!booking.paid_at || booking.hitpay_payment_status !== "completed") {
    return (
      <main className="mx-auto flex min-h-[70vh] max-w-5xl items-center px-4 py-12 sm:px-6 lg:px-8">
        <PaymentStatusPoller
          enabled
          fallbackMessage="Payment is being verified. You can check your rentals page for updates."
        />
        <Card className="w-full border-border/70">
          <CardHeader className="text-center">
            <Loader2 className="mx-auto size-12 animate-spin text-amber-500" />
            <CardTitle className="text-2xl">Processing your payment...</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <p className="text-center text-sm text-muted-foreground">
              This usually takes a few seconds.
            </p>
            <PaymentBreakdownCard
              breakdown={breakdown}
              defaultOpen
              pricingPeriod={booking.pricing_period}
              quantity={booking.quantity}
              rentalUnits={booking.rental_units || booking.num_units || 1}
              viewer="renter"
            />
            <div className="flex justify-center">
              <Button asChild variant="outline">
                <Link href="/renter/rentals">Check My Rentals</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-5xl items-center px-4 py-12 sm:px-6 lg:px-8">
      <Card className="w-full border-border/70">
        <CardHeader className="text-center">
          <CheckCircle2 className="mx-auto size-12 text-emerald-600" />
          <CardTitle className="text-2xl">
            {booking.status === "confirmed" ? "Booking Confirmed!" : "Payment received"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <PaymentBreakdownCard
            breakdown={breakdown}
            defaultOpen
            pricingPeriod={booking.pricing_period}
            quantity={booking.quantity}
            rentalUnits={booking.rental_units || booking.num_units || 1}
            viewer="renter"
          />

          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-800">
              What happens next
            </p>
            <div className="mt-3 space-y-2 text-sm text-emerald-950">
              <p>✅ Payment confirmed</p>
              <p>📞 Contact lister to arrange handover</p>
              <p>⏱ Rental starts when lister confirms handover</p>
              <p>📸 Lister will take a photo as proof</p>
            </div>
          </div>

          <div className="rounded-2xl border border-sky-200 bg-sky-50 p-5 text-sm text-sky-950">
            <p className="font-medium">Refund policy</p>
            <p className="mt-2">{getRefundPolicyMessage(booking.listing.cancellation_policy)}</p>
          </div>

          <div className="flex flex-wrap justify-center gap-3">
            <Button asChild>
              <Link href={`/dashboard/bookings/${booking.id}`}>View Booking</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/dashboard/my-rentals">View My Rentals</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
