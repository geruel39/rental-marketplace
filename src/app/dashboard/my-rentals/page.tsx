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
import { ReviewActionButton } from "@/components/reviews/review-action-button";
import { EmptyState } from "@/components/shared/empty-state";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { cn, formatCurrency, getInitials } from "@/lib/utils";
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

const tabButtonClassName =
  "h-10 rounded-xl px-4 text-sm font-medium shadow-none";
const secondaryActionClassName =
  "h-10 w-full justify-center rounded-xl border-border/70 bg-white px-4 text-sm font-semibold text-slate-900 shadow-sm hover:text-brand-navy [&_svg]:text-current";
const primaryActionClassName =
  "h-10 w-full justify-center rounded-xl px-4 text-sm font-semibold [&_svg]:text-current";

function getRentalActionPriority(booking: BookingWithDetails, currentUserId: string) {
  const canLeaveReview =
    booking.status === "completed" &&
    booking.renter_id === currentUserId &&
    !booking.renter_reviewed;

  if (canLeaveReview) return 0;
  if (booking.status === "active") return 1;
  if (booking.status === "confirmed") return 2;
  if (booking.status === "lister_confirmation") return 3;
  return 4;
}

function sortRentalBookings(bookings: BookingWithDetails[], currentUserId: string, filter: FilterKey) {
  const items = [...bookings];

  if (filter !== "all") {
    return items;
  }

  return items.sort((left, right) => {
    const priorityDiff =
      getRentalActionPriority(left, currentUserId) -
      getRentalActionPriority(right, currentUserId);

    if (priorityDiff !== 0) {
      return priorityDiff;
    }

    return new Date(right.updated_at).getTime() - new Date(left.updated_at).getTime();
  });
}

function RentalActions({
  booking,
  currentUserId,
}: {
  booking: BookingWithDetails;
  currentUserId: string;
}) {
  const canLeaveReview =
    booking.status === "completed" &&
    booking.renter_id === currentUserId &&
    !booking.renter_reviewed;

  if (booking.status === "lister_confirmation") {
    return (
      <div className="flex h-full flex-col gap-3 rounded-3xl border border-border/70 bg-muted/20 p-4 sm:p-5">
        <p className="text-sm leading-6 text-muted-foreground">Lister is confirming availability.</p>
        <p className="text-xs leading-5 text-muted-foreground">
          Confirm by: {booking.lister_confirmation_deadline ? new Date(booking.lister_confirmation_deadline).toLocaleString() : "TBD"}
        </p>
        <div className="mt-auto">
          <RenterCancelDialog
            booking={booking}
            fullWidth
            refundPreview="Cancel within 12 hours of payment for a 100% refund."
            triggerClassName={secondaryActionClassName}
            triggerSize="default"
          />
        </div>
      </div>
    );
  }

  if (booking.status === "confirmed") {
    return (
      <div className="flex h-full flex-col gap-3 rounded-3xl border border-border/70 bg-muted/20 p-4 sm:p-5">
        <p className="text-sm leading-6 text-muted-foreground">Arrange handover with the lister.</p>
        <div className="mt-auto">
          <RenterCancelDialog
            booking={booking}
            fullWidth
            refundPreview={getRefundPreview(booking)}
            triggerClassName={secondaryActionClassName}
            triggerSize="default"
          />
        </div>
      </div>
    );
  }

  if (booking.status === "active") {
    return (
      <div className="flex h-full flex-col gap-2 rounded-3xl border border-border/70 bg-muted/20 p-4 sm:p-5">
        <ReturnDialog
          booking={booking}
          fullWidth
          triggerClassName={cn(
            primaryActionClassName,
            "bg-brand-navy text-white hover:bg-brand-steel",
          )}
          triggerSize="default"
        />
        <RaiseDisputeDialog
          bookingId={booking.id}
          buttonClassName={secondaryActionClassName}
          buttonSize="default"
          fullWidth
        />
      </div>
    );
  }

  if (booking.status === "returned") {
    return (
      <div className="inline-flex min-h-10 w-full items-center rounded-3xl border border-emerald-200 bg-emerald-50/80 px-4 py-3 text-sm font-medium text-emerald-700">
        Return submitted. Waiting for lister inspection.
      </div>
    );
  }

  if (canLeaveReview) {
    return (
      <ReviewActionButton
        booking={booking}
        buttonClassName="shadow-sm"
        currentUserId={currentUserId}
        fullWidth
        size="default"
      />
    );
  }

  if (booking.status === "completed" && booking.renter_reviewed) {
    return (
      <div className="inline-flex min-h-10 w-full items-center rounded-3xl border border-emerald-200 bg-emerald-50/80 px-4 py-3 text-sm font-medium text-emerald-700">
        Review submitted.
      </div>
    );
  }

  return (
    <p className="inline-flex min-h-10 w-full items-center rounded-3xl border border-border/70 bg-muted/20 px-4 py-3 text-sm text-muted-foreground capitalize">
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
  const filteredBookings = sortRentalBookings(
    bookings.filter((booking) => matchesFilter(booking, activeFilter)),
    user.id,
    activeFilter,
  );

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">My Rentals</h1>
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
          Track confirmation, handover, return proof, and refund status for each booking.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 rounded-3xl border border-border/70 bg-white/90 p-2 shadow-sm">
        {rentalTabs.map((tab) => (
          <Button
            key={tab.key}
            asChild
            className={cn(
              tabButtonClassName,
              activeFilter === tab.key
                ? "bg-brand-navy text-white hover:bg-brand-steel"
                : "border border-transparent bg-transparent text-muted-foreground hover:border-brand-navy/15 hover:bg-brand-light hover:text-brand-navy",
            )}
            size="default"
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
                className="overflow-hidden rounded-[28px] border border-border/70 bg-white p-5 shadow-[0_14px_40px_-28px_rgba(15,23,42,0.45)] transition-shadow hover:shadow-[0_18px_44px_-28px_rgba(15,23,42,0.52)]"
              >
                <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_296px] lg:items-start">
                  <div className="flex min-w-0 items-start gap-4">
                    <Link
                      className="block size-20 shrink-0 overflow-hidden rounded-2xl bg-muted ring-1 ring-border/60"
                      href={`/listings/${booking.listing.id}`}
                    >
                      {booking.listing.images[0] ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img alt={booking.listing.title} className="h-full w-full object-cover" src={booking.listing.images[0]} />
                      ) : null}
                    </Link>

                    <div className="min-w-0 flex-1 space-y-4">
                      <div className="space-y-2">
                        <p className="line-clamp-1 text-lg font-semibold text-foreground">
                          {booking.listing.title}
                        </p>
                        <div className="flex flex-wrap items-center gap-2.5 text-sm">
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
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        <span className="rounded-full bg-muted/70 px-3 py-1.5 text-muted-foreground">
                          {formatDuration(booking)} x {booking.quantity} item{booking.quantity === 1 ? "" : "s"}
                        </span>
                        <span className="rounded-full bg-brand-light px-3 py-1.5 font-semibold text-brand-navy">
                          Paid: {formatCurrency(booking.total_price)}
                        </span>
                        <BookingStatusBadge size="sm" status={booking.status} />
                      </div>

                      {booking.status === "lister_confirmation" ? (
                        <p className="rounded-2xl bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                          Lister is confirming availability until{" "}
                          {booking.lister_confirmation_deadline
                            ? new Date(booking.lister_confirmation_deadline).toLocaleString()
                            : "TBD"}
                        </p>
                      ) : null}

                      <div className="flex flex-wrap items-center gap-3 pt-1">
                        <Link
                          className="inline-flex text-sm font-medium text-brand-navy hover:underline"
                          href={`/renter/rentals/${booking.id}`}
                        >
                          View details
                        </Link>
                      </div>

                      {booking.status === "active" &&
                      booking.rental_ends_at &&
                      booking.rental_started_at ? (
                        <RentalCountdown
                          rentalEndsAt={booking.rental_ends_at}
                          rentalStartedAt={booking.rental_started_at}
                          variant="compact"
                        />
                      ) : null}
                    </div>
                  </div>

                  <div className="w-full lg:w-[296px] lg:justify-self-end">
                    <RentalActions booking={booking} currentUserId={user.id} />
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
