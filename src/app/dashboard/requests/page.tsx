import { differenceInHours, formatDistanceToNowStrict } from "date-fns";
import { AlertTriangle, Receipt, Star } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { getIncomingBookings, listerConfirmBooking } from "@/actions/bookings";
import { BookingStatusBadge } from "@/components/bookings/booking-status-badge";
import { ConditionCheckForm } from "@/components/bookings/condition-check-form";
import { HandoverDialog } from "@/components/bookings/handover-dialog";
import { ListerCancelDialog } from "@/components/bookings/lister-cancel-dialog";
import { RaiseDisputeDialog } from "@/components/bookings/raise-dispute-dialog";
import { RentalCountdown } from "@/components/bookings/rental-countdown";
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

function formatDuration(booking: BookingWithDetails) {
  const units = booking.rental_units || booking.num_units || 1;
  return `${units} ${booking.pricing_period}${units === 1 ? "" : "s"}`;
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

function RequestActions({ booking }: { booking: BookingWithDetails }) {
  if (booking.status === "lister_confirmation") {
    return (
      <div className="space-y-4 rounded-2xl border border-red-200 bg-red-50/70 p-4">
        <p className="text-sm font-semibold text-red-700">
          {getConfirmationCountdown(booking.lister_confirmation_deadline)}
        </p>
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <form
            action={
              listerConfirmBooking.bind(null, booking.id) as unknown as (formData: FormData) => Promise<void>
            }
            className="sm:flex-1 sm:max-w-[140px]"
          >
            <Button
              className="w-full bg-emerald-600 text-white hover:bg-emerald-700"
              size="sm"
              type="submit"
            >
              Confirm
            </Button>
          </form>
          <ListerCancelDialog booking={booking} />
        </div>
      </div>
    );
  }

  if (booking.status === "confirmed") {
    return (
      <div className="space-y-3 rounded-2xl border border-border/60 bg-muted/30 p-4">
        <div className="flex justify-start lg:justify-end">
          <HandoverDialog booking={booking} />
        </div>
        <Button asChild className="w-full lg:w-auto" size="sm" variant="outline">
          <Link href="/dashboard/messages">Message renter</Link>
        </Button>
      </div>
    );
  }

  if (booking.status === "active") {
    return (
      <div className="space-y-3 rounded-2xl border border-border/60 bg-muted/30 p-4 text-left lg:text-right">
        <p className="text-sm text-muted-foreground">Waiting for renter to mark return.</p>
        <div className="flex justify-start lg:justify-end">
          <RaiseDisputeDialog bookingId={booking.id} buttonSize="sm" />
        </div>
      </div>
    );
  }

  if (booking.status === "returned") {
    return <ConditionCheckForm booking={booking} />;
  }

  return (
    <p className="rounded-2xl border border-border/60 bg-muted/30 p-4 text-left text-sm text-muted-foreground capitalize lg:text-right">
      {booking.status.replaceAll("_", " ")}
    </p>
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

      <div className="flex flex-wrap gap-2 rounded-2xl border border-border bg-background p-2">
        {requestTabs.map((tab) => (
          <Button
            key={tab.key}
            asChild
            className={activeFilter === tab.key ? "bg-brand-navy text-white hover:bg-brand-steel" : ""}
            size="sm"
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
              <article
                key={booking.id}
                className={cn(
                  "rounded-3xl border border-border/70 bg-background p-4 shadow-sm",
                  urgent && "border-l-4 border-l-red-600",
                )}
              >
                <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-start">
                  <div className="flex min-w-0 items-start gap-4">
                    <Link
                      className="block size-[72px] shrink-0 overflow-hidden rounded-2xl bg-muted"
                      href={`/listings/${booking.listing.id}`}
                    >
                      {booking.listing.images[0] ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img alt={booking.listing.title} className="h-full w-full object-cover" src={booking.listing.images[0]} />
                      ) : null}
                    </Link>

                    <div className="min-w-0 flex-1 space-y-3">
                      <div className="space-y-2">
                        <p className="line-clamp-1 text-base font-semibold text-foreground">
                          {booking.listing.title}
                        </p>
                        <div className="flex flex-wrap items-center gap-2 text-sm">
                          <Avatar size="sm">
                            <AvatarImage alt={renterName} src={booking.renter.avatar_url ?? undefined} />
                            <AvatarFallback>{getInitials(renterName)}</AvatarFallback>
                          </Avatar>
                          <span className="font-medium">{renterName}</span>
                          <span className="inline-flex items-center gap-1 text-muted-foreground">
                            <Star className="size-3.5 fill-current text-amber-500" />
                            {booking.renter.rating_as_renter.toFixed(1)}
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
                        <span>
                          {formatDuration(booking)} x {booking.quantity} item{booking.quantity === 1 ? "" : "s"}
                        </span>
                        <span className="font-semibold text-brand-navy">
                          Paid: {formatCurrency(booking.total_price)}
                        </span>
                        <BookingStatusBadge size="sm" status={booking.status} />
                      </div>

                      {urgent ? (
                        <p className="inline-flex items-center gap-2 text-sm font-medium text-red-700">
                          <AlertTriangle className="size-4" />
                          Priority confirmation required
                        </p>
                      ) : null}

                      <div className="flex flex-wrap items-center gap-3">
                        <Link
                          className="inline-flex text-sm font-medium text-brand-navy hover:underline"
                          href={`/lister/bookings/${booking.id}`}
                        >
                          View details
                        </Link>

                        {booking.status === "confirmed" && booking.lister_confirmation_deadline ? (
                          <p className="text-xs text-muted-foreground">
                            Confirmed{" "}
                            {formatDistanceToNowStrict(new Date(booking.lister_confirmation_deadline), {
                              addSuffix: true,
                            })}
                          </p>
                        ) : null}
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

                  <div className="w-full">
                    <RequestActions booking={booking} />
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
