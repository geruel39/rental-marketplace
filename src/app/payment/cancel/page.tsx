import Link from "next/link";
import { XCircle } from "lucide-react";

import { getBookingDetails } from "@/actions/bookings";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type SearchParams = Record<string, string | string[] | undefined>;

function getSingleValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

interface PaymentCancelPageProps {
  searchParams: Promise<SearchParams>;
}

export default async function PaymentCancelPage({
  searchParams,
}: PaymentCancelPageProps) {
  const resolvedSearchParams = await searchParams;
  const bookingId = getSingleValue(resolvedSearchParams.booking);
  const booking = bookingId ? await getBookingDetails(bookingId) : null;

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-3xl items-center px-4 py-12 sm:px-6 lg:px-8">
      <Card className="w-full border-border/70">
        <CardHeader className="text-center">
          <XCircle className="mx-auto size-12 text-destructive" />
          <CardTitle className="text-2xl">Payment Cancelled</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6 text-center">
          <p className="text-sm text-muted-foreground">
            Your payment was cancelled before completion. You can try again or return to your dashboard.
          </p>
          <div className="flex flex-col justify-center gap-3 sm:flex-row">
            <Button asChild>
              <Link href={booking?.hitpay_payment_url ?? "/dashboard/my-rentals"}>
                Try Again
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/dashboard">Return to Dashboard</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
