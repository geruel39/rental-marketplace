import { differenceInHours } from "date-fns";
import { PackageSearch } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { getMyRentals } from "@/actions/bookings";
import { BookingListItem } from "@/components/bookings/booking-list-item";
import { RaiseDisputeDialog } from "@/components/bookings/raise-dispute-dialog";
import { RentalCountdown } from "@/components/bookings/rental-countdown";
import { RenterCancelDialog } from "@/components/bookings/renter-cancel-dialog";
import { ReturnDialog } from "@/components/bookings/return-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
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

const actionButtonClass =
  "h-10 w-full rounded-xl px-4 text-sm font-medium";

function RentalActions({ booking }: { booking: BookingWithDetails }) {
  if (booking.status === "lister_confirmation") {
    return (
      <>
        <div className="space-y-2">
          <p className="text-sm font-semibold text-foreground">Awaiting lister confirmation</p>
          <p className="text-sm text-muted-foreground">
            The lister will confirm availability before the rental starts.
          </p>
        </div>
        <div className="mt-4 space-y-2">
          <RenterCancelDialog
            booking={booking}
            refundPreview="Cancel within 12 hours of payment for a 100% refund."
            triggerClassName={cn(actionButtonClass, "w-full")}
          />
        </div>
      </>
    );
  }

  if (booking.status === "confirmed") {
    return (
      <>
        <div className="space-y-2">
          <p className="text-sm font-semibold text-foreground">Ready for pickup</p>
          <p className="text-sm text-muted-foreground">
            Coordinate handover with the lister before the rental begins.
          </p>
        </div>
        <div className="mt-4 space-y-2">
          <RenterCancelDialog
            booking={booking}
            refundPreview={getRefundPreview(booking)}
            triggerClassName={cn(actionButtonClass, "w-full")}
          />
        </div>
      </>
    );
  }

  if (booking.status === "active") {
    return (
      <>
        <div className="space-y-2">
          <p className="text-sm font-semibold text-foreground">Rental active</p>
          <p className="text-sm text-muted-foreground">
            Confirm the return when the item has been handed back.
          </p>
        </div>
        <div className="mt-4 space-y-2">
          <ReturnDialog
            booking={booking}
            triggerClassName={cn(actionButtonClass, "w-full")}
          />
          <RaiseDisputeDialog
            bookingId={booking.id}
            buttonClassName={actionButtonClass}
            buttonSize="default"
            fullWidth
          />
        </div>
      </>
    );
  }

  return (
    <div className="flex h-full flex-col justify-between gap-4">
      <div className="space-y-2">
        <p className="text-sm font-semibold text-foreground">Rental status</p>
        <p className="text-sm text-muted-foreground capitalize">
          {booking.status.replaceAll("_", " ")}
        </p>
      </div>
      <div className="rounded-2xl border border-border/70 bg-white px-3 py-3 text-sm text-muted-foreground">
        No actions available right now.
      </div>
    </div>
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

      <div className="flex flex-wrap gap-2 rounded-[24px] border border-border/70 bg-white p-2 shadow-sm shadow-black/5">
        {rentalTabs.map((tab) => (
          <Button
            key={tab.key}
            asChild
            className={cn(
              "h-10 rounded-xl px-4 text-sm font-medium",
              activeFilter === tab.key ? "bg-brand-navy text-white hover:bg-brand-steel" : "",
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
              <BookingListItem
                key={booking.id}
                actionPanel={<RentalActions booking={booking} />}
                booking={booking}
                countdown={
                  booking.status === "active" &&
                  booking.rental_ends_at &&
                  booking.rental_started_at ? (
                    <RentalCountdown
                      rentalEndsAt={booking.rental_ends_at}
                      rentalStartedAt={booking.rental_started_at}
                      variant="compact"
                    />
                  ) : null
                }
                counterpartAvatarUrl={booking.lister.avatar_url}
                counterpartLabel="Lister"
                counterpartName={listerName}
                counterpartRating={booking.lister.rating_as_lister}
                detailHref={`/renter/rentals/${booking.id}`}
                note={
                  booking.status === "lister_confirmation" ? (
                    <span>
                      Lister is confirming availability until{" "}
                      {booking.lister_confirmation_deadline
                        ? new Date(booking.lister_confirmation_deadline).toLocaleString()
                        : "TBD"}
                    </span>
                  ) : null
                }
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
