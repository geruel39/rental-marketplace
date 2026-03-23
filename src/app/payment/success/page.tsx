import Link from "next/link";
import { CheckCircle2, Loader2 } from "lucide-react";

import { getBookingDetails } from "@/actions/bookings";
import { checkPaymentStatus } from "@/actions/hitpay";
import { PaymentStatusPoller } from "@/components/payments/payment-status-poller";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, formatDate } from "@/lib/utils";

type SearchParams = Record<string, string | string[] | undefined>;

function getSingleValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

interface PaymentSuccessPageProps {
  searchParams: Promise<SearchParams>;
}

export default async function PaymentSuccessPage({
  searchParams,
}: PaymentSuccessPageProps) {
  const resolvedSearchParams = await searchParams;
  const bookingId = getSingleValue(resolvedSearchParams.booking);
  let booking = bookingId ? await getBookingDetails(bookingId) : null;

  if (bookingId && booking && booking.hitpay_payment_status !== "completed") {
    const paymentStatus = await checkPaymentStatus(bookingId);

    if (paymentStatus.status === "completed") {
      booking = await getBookingDetails(bookingId);
    }
  }

  const isPaid = booking?.hitpay_payment_status === "completed";

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-3xl items-center px-4 py-12 sm:px-6 lg:px-8">
      <PaymentStatusPoller enabled={Boolean(bookingId && !isPaid)} />
      <Card className="w-full border-border/70">
        <CardHeader className="text-center">
          {isPaid ? (
            <CheckCircle2 className="mx-auto size-12 text-emerald-600" />
          ) : (
            <Loader2 className="mx-auto size-12 animate-spin text-primary" />
          )}
          <CardTitle className="text-2xl">
            {isPaid ? "Payment Successful!" : "Payment is being processed..."}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {booking && isPaid ? (
            <div className="space-y-3 rounded-2xl bg-muted/40 p-5 text-sm">
              <p>
                <span className="font-medium">Listing:</span> {booking.listing.title}
              </p>
              <p>
                <span className="font-medium">Dates:</span> {formatDate(booking.start_date)} -{" "}
                {formatDate(booking.end_date)}
              </p>
              <p>
                <span className="font-medium">Amount:</span> {formatCurrency(booking.total_price)}
              </p>
            </div>
          ) : (
            <p className="text-center text-sm text-muted-foreground">
              We are waiting for HitPay to confirm your payment. This page will refresh automatically.
            </p>
          )}

          <div className="flex justify-center">
            <Button asChild>
              <Link href="/dashboard/my-rentals">View My Rentals</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
