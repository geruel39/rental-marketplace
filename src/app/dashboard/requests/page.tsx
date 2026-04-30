import { differenceInHours, formatDistanceToNowStrict } from "date-fns";
import { AlertTriangle, Receipt, Star } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { getIncomingBookings, listerConfirmBooking } from "@/actions/bookings";
import { BookingListItem } from "@/components/bookings/booking-list-item";
import { BookingStatusBadge } from "@/components/bookings/booking-status-badge";
import { ConditionCheckForm } from "@/components/bookings/condition-check-form";
import { HandoverDialog } from "@/components/bookings/handover-dialog";
import { ListerCancelDialog } from "@/components/bookings/lister-cancel-dialog";
import { ListerConfirmButton } from "@/components/bookings/lister-confirm-button";
import { RaiseDisputeDialog } from "@/components/bookings/raise-dispute-dialog";
import { RentalCountdown } from "@/components/bookings/rental-countdown";
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

const requestTabs: Array<{ key: FilterKey; label: string }> = [
  { key: "all", label: "All" },
  { key: "lister_confirmation", label: "Needs Confirmation" },
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
  return requestTabs.some((tab) => tab.key === value) ? (value as FilterKey) : "all";
}

function matchesFilter(booking: BookingWithDetails, filter: FilterKey) {
  if (filter === "all") return true;
  if (filter === "cancelled") {
    return booking.status === "cancelled_by_lister" || booking.status === "cancelled_by_renter";
  }
  return booking.status === filter;
}

function getConfirmationCountdown(deadline?: string | null) {
  if (!deadline) return "Confirm within 24 hours or it auto-cancels";
  const deadlineDate = new Date(deadline);
  const hours = Math.max(0, differenceInHours(deadlineDate, new Date()));
  if (deadlineDate.getTime() <= Date.now()) {
    return "Confirmation window expired";
  }
  return `Confirm in ${hours} hr${hours === 1 ? "" : "s"} or auto-cancels`;
}

const actionButtonClass =
  "h-10 w-full rounded-xl px-4 text-sm font-medium";

function RequestActions({ booking }: { booking: BookingWithDetails }) {
  if (booking.status === "lister_confirmation") {
    return (
      <>
        <div className="space-y-2">
          <p className="text-sm font-semibold text-red-700">
            Priority confirmation
          </p>
          <p className="text-sm text-muted-foreground">
            {getConfirmationCountdown(booking.lister_confirmation_deadline)}
          </p>
        </div>

        <div className="mt-4 space-y-2">
          <ListerConfirmButton bookingId={booking.id} className={actionButtonClass} />
          <ListerCancelDialog
            booking={booking}
            triggerClassName={cn(actionButtonClass, "border-0")}
          />
        </div>
      </>
    );
  }

  if (booking.status === "confirmed") {
    return (
      <>
        <div className="space-y-2">
          <p className="text-sm font-semibold text-foreground">Ready for handover</p>
          <p className="text-sm text-muted-foreground">
            Confirm the item handover to start the rental period.
          </p>
        </div>

        <div className="mt-4 space-y-2">
          <HandoverDialog
            booking={booking}
            triggerClassName={cn(
              actionButtonClass,
              "bg-brand-navy text-white hover:bg-brand-steel",
            )}
          />
          <Button asChild className={actionButtonClass} variant="outline">
            <Link href="/dashboard/messages">Message renter</Link>
          </Button>
        </div>
      </>
    );
  }

  if (booking.status === "active") {
    return (
      <>
        <div className="space-y-2">
          <p className="text-sm font-semibold text-foreground">Rental in progress</p>
          <p className="text-sm text-muted-foreground">
            Waiting for the renter to confirm the return.
          </p>
        </div>

        <div className="mt-4 space-y-2">
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

  if (booking.status === "returned") {
    return (
      <>
        <div className="space-y-2">
          <p className="text-sm font-semibold text-foreground">Inspect returned item</p>
          <p className="text-sm text-muted-foreground">
            Review the condition and complete the booking.
          </p>
        </div>
        <div className="mt-4">
          <ConditionCheckForm booking={booking} triggerClassName={cn(actionButtonClass, "w-full")} />
        </div>
      </>
    );
  }

  return (
    <div className="flex h-full flex-col justify-between gap-4">
      <div className="space-y-2">
        <p className="text-sm font-semibold text-foreground">Booking status</p>
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

export default async function RequestsPage({
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
  const bookings = await getIncomingBookings(user.id);
  const filteredBookings = bookings.filter((booking) => matchesFilter(booking, activeFilter));

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Incoming Bookings</h1>
        <p className="text-sm text-muted-foreground">
          Confirm paid bookings, handle handover proof, and complete inspections after return.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 rounded-[24px] border border-border/70 bg-white p-2 shadow-sm shadow-black/5">
        {requestTabs.map((tab) => (
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
            <Link href={`/dashboard/requests?status=${tab.key}`}>{tab.label}</Link>
          </Button>
        ))}
      </div>

      {filteredBookings.length === 0 ? (
        <EmptyState
          actionHref="/dashboard/my-listings"
          actionLabel="View My Listings"
          description="New incoming bookings will appear here."
          icon={Receipt}
          title="No incoming bookings"
        />
      ) : (
        <div className="space-y-4">
          {filteredBookings.map((booking) => {
            const renterName = booking.renter.display_name || booking.renter.full_name;
            const urgent = booking.status === "lister_confirmation";

            return (
              <BookingListItem
                key={booking.id}
                actionPanel={<RequestActions booking={booking} />}
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
                counterpartAvatarUrl={booking.renter.avatar_url}
                counterpartLabel="Renter"
                counterpartName={renterName}
                counterpartRating={booking.renter.rating_as_renter}
                detailHref={`/lister/bookings/${booking.id}`}
                note={
                  urgent ? (
                    <span className="inline-flex items-center gap-2 text-red-700">
                      <AlertTriangle className="size-4" />
                      Priority confirmation required before the request expires.
                    </span>
                  ) : booking.status === "confirmed" &&
                    booking.lister_confirmation_deadline ? (
                    <span>
                      Confirmed{" "}
                      {formatDistanceToNowStrict(new Date(booking.lister_confirmation_deadline), {
                        addSuffix: true,
                      })}
                    </span>
                  ) : null
                }
                urgent={urgent}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
