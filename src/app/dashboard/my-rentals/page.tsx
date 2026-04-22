import { differenceInHours } from "date-fns";
import { PackageSearch, Star } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { getMyRentals } from "@/actions/bookings";
import { BookingStatusBadge } from "@/components/bookings/booking-status-badge";
import { RaiseDisputeDialog } from "@/components/bookings/raise-dispute-dialog";
import { RentalCountdown } from "@/components/bookings/rental-countdown";
import { RenterCancelDialog } from "@/components/bookings/renter-cancel-dialog";
import { ReturnDialog } from "@/components/bookings/return-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency, getInitials } from "@/lib/utils";
import type { BookingWithDetails } from "@/types";

type SearchParams = Record<string, string | string[] | undefined>;
type FilterKey =
  | "all"
  | "lister_confirmation"
  | "confirmed"
  | "active"
  | "returned"
  | "completed"
  | "cancelled"
  | "disputed";

const rentalTabs: Array<{ key: FilterKey; label: string }> = [
  { key: "all", label: "All" },
  { key: "lister_confirmation", label: "Awaiting Confirmation" },
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

function formatDuration(booking: BookingWithDetails) {
  const units = booking.rental_units || booking.num_units || 1;
  return `${units} ${booking.pricing_period}${units === 1 ? "" : "s"}`;
}

function getRefundPreview(booking: BookingWithDetails) {
  if (!booking.paid_at) {
    return "No payment captured yet. If you cancel now, nothing will be charged.";
  }

  const hoursSincePaid = differenceInHours(new Date(), new Date(booking.paid_at));
  if (hoursSincePaid <= 12) {
    return "Cancel within 12 hours of payment for a 100% refund.";
  }
  if (hoursSincePaid <= 24) {
    return "Cancel between 12 and 24 hours after payment for 50% of rental charges plus full deposit.";
  }
  return "Cancel after 24 hours and only the deposit is refunded.";
}

function RentalActions({ booking }: { booking: BookingWithDetails }) {
  if (booking.status === "lister_confirmation") {
    return (
      <div className="space-y-3 text-right">
        <p className="text-sm text-muted-foreground">Lister is confirming availability.</p>
        <p className="text-xs text-muted-foreground">
          Confirm by: {booking.lister_confirmation_deadline ? new Date(booking.lister_confirmation_deadline).toLocaleString() : "TBD"}
        </p>
        <div className="flex justify-end">
          <RenterCancelDialog
            booking={booking}
            refundPreview="Cancel within 12 hours of payment for a 100% refund."
          />
        </div>
      </div>
    );
  }

  if (booking.status === "confirmed") {
    return (
      <div className="space-y-3 text-right">
        <p className="text-sm text-muted-foreground">Arrange handover with the lister.</p>
        <div className="flex justify-end">
          <RenterCancelDialog booking={booking} refundPreview={getRefundPreview(booking)} />
        </div>
      </div>
    );
  }

  if (booking.status === "active") {
    return (
      <div className="space-y-3 text-right">
        <div className="flex justify-end">
          <ReturnDialog booking={booking} />
        </div>
        <div className="flex justify-end">
          <RaiseDisputeDialog bookingId={booking.id} buttonSize="sm" />
        </div>
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
  const bookings = await getMyRentals(user.id);
  const filteredBookings = bookings.filter((booking) => matchesFilter(booking, activeFilter));

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">My Rentals</h1>
        <p className="text-sm text-muted-foreground">
          Track confirmation, handover, return proof, and refund status for each booking.
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
          description="You have no rentals in this view."
          icon={PackageSearch}
          title="No rentals yet"
        />
      ) : (
        <div className="space-y-4">
          {filteredBookings.map((booking) => {
            const listerName = booking.lister.display_name || booking.lister.full_name;

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

                      {booking.status === "lister_confirmation" ? (
                        <p className="text-sm text-muted-foreground">
                          Lister is confirming availability until{" "}
                          {booking.lister_confirmation_deadline
                            ? new Date(booking.lister_confirmation_deadline).toLocaleString()
                            : "TBD"}
                        </p>
                      ) : null}

                      {booking.status === "active" &&
                      booking.rental_ends_at &&
                      booking.rental_started_at ? (
                        <RentalCountdown
                          rentalEndsAt={booking.rental_ends_at}
                          rentalStartedAt={booking.rental_started_at}
                          variant="compact"
                        />
                      ) : null}

                      <Link
                        className="inline-flex text-sm font-medium text-brand-navy hover:underline"
                        href={`/renter/rentals/${booking.id}`}
                      >
                        View Details {"->"}
                      </Link>
                    </div>
                  </div>

                  <div className="w-full lg:w-[280px]">
                    <RentalActions booking={booking} />
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
