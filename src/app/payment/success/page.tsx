import Link from "next/link";
import { format } from "date-fns";
import { CheckCircle2, Loader2, TriangleAlert } from "lucide-react";

import { getBookingDetails } from "@/actions/bookings";
import { BookingSummaryCard } from "@/components/bookings/booking-summary-card";
import { PaymentStatusPoller } from "@/components/payments/payment-status-poller";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type SearchParams = Record<string, string | string[] | undefined>;

interface PaymentSuccessPageProps {
  searchParams: Promise<SearchParams>;
}

function getSingleValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function formatDateTime(value?: string | null) {
  if (!value) {
    return "To be confirmed";
  }

  return format(new Date(value), "PPP p");
}

export default async function PaymentSuccessPage({
  searchParams,
}: PaymentSuccessPageProps) {
  const resolvedSearchParams = await searchParams;
  const bookingId = getSingleValue(resolvedSearchParams.booking);
  const booking = bookingId ? await getBookingDetails(bookingId) : null;

  if (!bookingId || !booking) {
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

  if (booking.status === "confirmed") {
    return (
      <main className="mx-auto flex min-h-[70vh] max-w-4xl items-center px-4 py-12 sm:px-6 lg:px-8">
        <Card className="w-full border-border/70">
          <CardHeader className="text-center">
            <CheckCircle2 className="mx-auto size-12 text-emerald-600" />
            <CardTitle className="text-2xl">Payment Successful!</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <BookingSummaryCard booking={booking} />

            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950">
              {booking.fulfillment_type === "pickup" ? (
                <p>
                  Your pickup is scheduled for {formatDateTime(booking.pickup_scheduled_at)}.
                  Location: {booking.listing.location}.
                </p>
              ) : (
                <p>
                  Your item will be delivered to{" "}
                  {[booking.delivery_address, booking.delivery_city, booking.delivery_state, booking.delivery_postal_code]
                    .filter(Boolean)
                    .join(", ")}{" "}
                  on {formatDateTime(booking.delivery_scheduled_at)}.
                </p>
              )}
            </div>

            <div className="flex flex-wrap justify-center gap-3">
              <Button asChild>
                <Link href={`/dashboard/bookings/${booking.id}`}>View Booking Details</Link>
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

  if (booking.status === "awaiting_payment") {
    return (
      <main className="mx-auto flex min-h-[70vh] max-w-4xl items-center px-4 py-12 sm:px-6 lg:px-8">
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

            <BookingSummaryCard booking={booking} />

            <div className="flex justify-center">
              <Button asChild variant="outline">
                <Link href="/dashboard/my-rentals">Check My Rentals</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-3xl items-center px-4 py-12 sm:px-6 lg:px-8">
      <Card className="w-full border-border/70">
        <CardHeader className="text-center">
          <TriangleAlert className="mx-auto size-12 text-amber-600" />
          <CardTitle className="text-2xl">Payment received</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6 text-center">
          <p className="text-sm text-muted-foreground">
            Your booking is currently in the <strong>{booking.status.replaceAll("_", " ")}</strong> state.
            Please check your booking details for the latest update.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Button asChild>
              <Link href={`/dashboard/bookings/${booking.id}`}>View Booking Details</Link>
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
