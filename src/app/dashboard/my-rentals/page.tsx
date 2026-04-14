import { PackageSearch, Star } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { cancelBooking, getMyRentals } from "@/actions/bookings";
import { getFeeConfig } from "@/actions/payments";
import { BookingStatusBadge } from "@/components/bookings/booking-status-badge";
import { PaymentButton } from "@/components/bookings/payment-button";
import { PaymentCountdown } from "@/components/bookings/payment-countdown";
import { RaiseDisputeDialog } from "@/components/bookings/raise-dispute-dialog";
import { RentalCountdown } from "@/components/bookings/rental-countdown";
import { ReturnDialog } from "@/components/bookings/return-dialog";
import { PaymentBreakdownCard } from "@/components/payments/payment-breakdown-card";
import { RefundStatusCard } from "@/components/payments/refund-status-card";
import { EmptyState } from "@/components/shared/empty-state";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { calculatePaymentBreakdown, cn, formatCurrency, getInitials } from "@/lib/utils";
import type { BookingWithDetails, Refund } from "@/types";

type SearchParams = Record<string, string | string[] | undefined>;
type FilterKey =
  | "all"
  | "pending"
  | "awaiting_payment"
  | "confirmed"
  | "active"
  | "returned"
  | "completed"
  | "cancelled"
  | "disputed";

const rentalTabs: Array<{ key: FilterKey; label: string }> = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "awaiting_payment", label: "Awaiting Payment" },
  { key: "confirmed", label: "Confirmed" },
  { key: "active", label: "Active" },
  { key: "returned", label: "Returned" },
  { key: "completed", label: "Completed" },
  { key: "cancelled", label: "Cancelled" },
  { key: "disputed", label: "Disputed" },
];

function getSingleValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function getFilter(value?: string): FilterKey {
  return rentalTabs.some((tab) => tab.key === value) ? (value as FilterKey) : "all";
}

function matchesFilter(booking: BookingWithDetails, filter: FilterKey) {
  if (filter === "all") return true;
  if (filter === "cancelled") {
    return booking.status === "cancelled_by_lister" || booking.status === "cancelled_by_renter";
  }
  return booking.status === filter;
}

function getEmptyDescription(filter: FilterKey) {
  switch (filter) {
    case "pending":
      return "No pending requests at the moment.";
    case "awaiting_payment":
      return "No bookings waiting for payment.";
    case "confirmed":
      return "No confirmed bookings right now.";
    case "active":
      return "No active rentals right now.";
    case "returned":
      return "No rentals waiting for lister inspection.";
    case "completed":
      return "No completed rentals in this view.";
    case "cancelled":
      return "No cancelled rentals in this view.";
    case "disputed":
      return "No disputed rentals currently.";
    default:
      return "You have no rentals yet.";
  }
}

function formatDuration(booking: BookingWithDetails) {
  const units = booking.rental_units || booking.num_units || 1;
  const period = booking.pricing_period;
  return `${units} ${period}${units === 1 ? "" : "s"}`;
}

function maskPaymentReference(reference?: string | null) {
  if (!reference) return "Pending";
  if (reference.length <= 8) return reference;
  return `${reference.slice(0, 4)}••••${reference.slice(-4)}`;
}

function getConditionTone(condition?: string | null) {
  switch (condition) {
    case "excellent":
      return "bg-emerald-100 text-emerald-800";
    case "good":
      return "bg-blue-100 text-blue-800";
    case "fair":
      return "bg-yellow-100 text-yellow-800";
    case "damaged":
    case "missing_parts":
      return "bg-red-100 text-red-800";
    default:
      return "bg-muted text-muted-foreground";
  }
}

function RentalActions({ booking }: { booking: BookingWithDetails }) {
  if (booking.status === "pending") {
    return (
      <div className="space-y-2 text-right">
        <p className="text-sm text-muted-foreground">Waiting for lister review</p>
        <form
          action={
            cancelBooking.bind(
              null,
              booking.id,
              "Cancelled by renter before acceptance.",
            ) as unknown as (formData: FormData) => Promise<void>
          }
        >
          <Button size="sm" variant="outline">
            Cancel Request
          </Button>
        </form>
      </div>
    );
  }

  if (booking.status === "awaiting_payment") {
    return (
      <div className="space-y-2 text-right">
        <div className="flex justify-end">
          <PaymentButton
            bookingId={booking.id}
            className="bg-brand-navy text-white hover:bg-brand-steel"
            paymentUrl={booking.hitpay_payment_url}
          />
        </div>
        {booking.payment_expires_at ? (
          <div className="inline-flex">
            <PaymentCountdown expiresAt={booking.payment_expires_at} />
          </div>
        ) : null}
      </div>
    );
  }

  if (booking.status === "confirmed") {
    return (
      <div className="space-y-2 text-right">
        <Badge className="bg-emerald-100 text-emerald-900">
          Paid ✓ {formatCurrency(booking.total_price)}
        </Badge>
        <p className="text-sm text-muted-foreground">
          HitPay ref: {maskPaymentReference(booking.hitpay_payment_id)}
        </p>
        <Button asChild size="sm" variant="outline">
          <Link href="/dashboard/messages">Message Lister</Link>
        </Button>
      </div>
    );
  }

  if (booking.status === "active") {
    return (
      <div className="space-y-2 text-right">
        <div className="flex justify-end">
          <ReturnDialog booking={booking} />
        </div>
        <div className="flex justify-end">
          <RaiseDisputeDialog bookingId={booking.id} buttonSize="sm" />
        </div>
      </div>
    );
  }

  if (booking.status === "completed") {
    return (
      <div className="space-y-2 text-right">
        {booking.return_condition ? (
          <span
            className={cn(
              "inline-flex rounded-full px-2 py-1 text-xs font-medium capitalize",
              getConditionTone(booking.return_condition),
            )}
          >
            {booking.return_condition.replaceAll("_", " ")}
          </span>
        ) : null}
        {!booking.renter_reviewed ? (
          <Button asChild size="sm" variant="outline">
            <Link href="/dashboard/reviews">Leave Review</Link>
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <p className="text-right text-sm text-muted-foreground capitalize">
      {booking.status.replaceAll("_", " ")}
    </p>
  );
}

export default async function MyRentalsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const resolvedSearchParams = await searchParams;
  const activeFilter = getFilter(getSingleValue(resolvedSearchParams.status));
  const [bookings, fees] = await Promise.all([getMyRentals(user.id), getFeeConfig()]);
  const filteredBookings = bookings.filter((booking) => matchesFilter(booking, activeFilter));
  const bookingIds = bookings.map((booking) => booking.id);

  const refundMap = new Map<string, Refund>();
  if (bookingIds.length > 0) {
    const { data: refunds } = await supabase
      .from("refunds")
      .select("*")
      .in("booking_id", bookingIds)
      .order("created_at", { ascending: false });

    for (const refund of (refunds ?? []) as Refund[]) {
      if (!refundMap.has(refund.booking_id)) {
        refundMap.set(refund.booking_id, refund);
      }
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">My Rentals</h1>
        <p className="text-sm text-muted-foreground">
          Track payment, handover, refunds, and completion for every booking.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 rounded-2xl border border-border bg-background p-2">
        {rentalTabs.map((tab) => (
          <Button
            key={tab.key}
            asChild
            className={activeFilter === tab.key ? "bg-brand-navy text-white hover:bg-brand-steel" : ""}
            size="sm"
            variant={activeFilter === tab.key ? "default" : "ghost"}
          >
            <Link href={`/dashboard/my-rentals?status=${tab.key}`}>{tab.label}</Link>
          </Button>
        ))}
      </div>

      {filteredBookings.length === 0 ? (
        <EmptyState
          actionHref="/listings"
          actionLabel="Browse Listings"
          description={getEmptyDescription(activeFilter)}
          icon={PackageSearch}
          title="No rentals yet"
        />
      ) : (
        <div className="space-y-4">
          {filteredBookings.map((booking) => {
            const listerName = booking.lister.display_name || booking.lister.full_name;
            const refund = refundMap.get(booking.id);
            const breakdown = calculatePaymentBreakdown({
              subtotal: booking.subtotal,
              depositAmount: booking.deposit_amount,
              pricingPeriod: booking.pricing_period,
              fees,
            });

            return (
              <article
                key={booking.id}
                className="rounded-2xl border border-border/70 bg-background p-4 shadow-sm"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="flex min-w-0 flex-1 items-start gap-3">
                    <Link
                      className="block size-[60px] shrink-0 overflow-hidden rounded-xl bg-muted"
                      href={`/listings/${booking.listing.id}`}
                    >
                      {booking.listing.images[0] ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img alt={booking.listing.title} className="h-full w-full object-cover" src={booking.listing.images[0]} />
                      ) : null}
                    </Link>

                    <div className="min-w-0 flex-1 space-y-2">
                      <p className="line-clamp-1 font-semibold">{booking.listing.title}</p>
                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        <Avatar size="sm">
                          <AvatarImage alt={listerName} src={booking.lister.avatar_url ?? undefined} />
                          <AvatarFallback>{getInitials(listerName)}</AvatarFallback>
                        </Avatar>
                        <span className="font-medium">{listerName}</span>
                        <span className="inline-flex items-center gap-1 text-muted-foreground">
                          <Star className="size-3.5 fill-current text-amber-500" />
                          {booking.lister.rating_as_lister.toFixed(1)}
                        </span>
                      </div>

                      <p className="text-sm text-muted-foreground">
                        {formatDuration(booking)} x {booking.quantity} item{booking.quantity === 1 ? "" : "s"}
                      </p>
                      <p className="font-semibold text-brand-navy">{formatCurrency(booking.total_price)}</p>
                      <BookingStatusBadge size="sm" status={booking.status} />

                      {booking.status === "active" &&
                      booking.rental_ends_at &&
                      booking.rental_started_at ? (
                        <RentalCountdown
                          rentalEndsAt={booking.rental_ends_at}
                          rentalStartedAt={booking.rental_started_at}
                          variant="compact"
                        />
                      ) : null}

                      {booking.status === "completed" ? (
                        <p className="text-sm text-muted-foreground">
                          Payment summary: paid {formatCurrency(booking.total_price)}
                          {refund ? `, received refund ${formatCurrency(refund.refund_amount, refund.currency)}` : ""}
                        </p>
                      ) : null}

                      <Link
                        className="inline-flex text-sm font-medium text-brand-navy hover:underline"
                        href={`/dashboard/bookings/${booking.id}`}
                      >
                        View Details →
                      </Link>
                    </div>
                  </div>

                  <div className="w-full lg:w-[280px]">
                    <RentalActions booking={booking} />
                  </div>
                </div>

                {(booking.status === "awaiting_payment" ||
                  booking.status === "confirmed" ||
                  booking.status === "completed" ||
                  refund) ? (
                  <div className="mt-5 space-y-4 border-t border-border/70 pt-5">
                    {(booking.status === "awaiting_payment" || booking.status === "confirmed") ? (
                      <PaymentBreakdownCard
                        breakdown={breakdown}
                        pricingPeriod={booking.pricing_period}
                        quantity={booking.quantity}
                        rentalUnits={booking.rental_units || booking.num_units || 1}
                        viewer="renter"
                      />
                    ) : null}
                    {refund ? <RefundStatusCard refund={refund} /> : null}
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
