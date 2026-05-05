import { differenceInHours, formatDistanceToNowStrict } from "date-fns";
import { AlertTriangle, Receipt, Star } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { getIncomingBookings, listerConfirmBooking } from "@/actions/bookings";
import { BookingStatusBadge } from "@/components/bookings/booking-status-badge";
import { ConditionCheckForm } from "@/components/bookings/condition-check-form";
import { HandoverDialog } from "@/components/bookings/handover-dialog";
import { ListerCancelDialog } from "@/components/bookings/lister-cancel-dialog";
import { PendingSubmitButton } from "@/components/bookings/pending-submit-button";
import { RaiseDisputeDialog } from "@/components/bookings/raise-dispute-dialog";
import { RentalCountdown } from "@/components/bookings/rental-countdown";
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

const tabButtonClassName =
  "h-10 rounded-xl px-4 text-sm font-medium shadow-none";
const secondaryActionClassName =
  "h-10 w-full justify-center rounded-xl border-border/70 bg-white px-4 text-sm font-semibold text-slate-900 shadow-sm hover:text-brand-navy [&_svg]:text-current";
const primaryActionClassName =
  "h-10 w-full justify-center rounded-xl px-4 text-sm font-semibold [&_svg]:text-current";

function hasRequestAction(booking: BookingWithDetails, currentUserId: string) {
  if (
    booking.status === "completed" &&
    booking.lister_id === currentUserId &&
    !booking.lister_reviewed
  ) {
    return true;
  }

  return (
    booking.status === "lister_confirmation" ||
    booking.status === "returned" ||
    booking.status === "confirmed" ||
    booking.status === "active"
  );
}

function sortRequestBookings(bookings: BookingWithDetails[], currentUserId: string, filter: FilterKey) {
  const items = [...bookings];

  if (filter !== "all") {
    return items;
  }

  return items.sort((left, right) => {
    const leftHasAction = hasRequestAction(left, currentUserId);
    const rightHasAction = hasRequestAction(right, currentUserId);

    if (leftHasAction !== rightHasAction) {
      return leftHasAction ? -1 : 1;
    }

    return new Date(right.updated_at).getTime() - new Date(left.updated_at).getTime();
  });
}

function RequestActions({
  booking,
  currentUserId,
}: {
  booking: BookingWithDetails;
  currentUserId: string;
}) {
  const canLeaveReview =
    booking.status === "completed" &&
    booking.lister_id === currentUserId &&
    !booking.lister_reviewed;

  if (booking.status === "lister_confirmation") {
    return (
      <div className="flex h-full flex-col gap-4 rounded-3xl border border-red-200 bg-red-50/80 p-4 sm:p-5">
        <p className="text-sm font-semibold leading-6 text-red-700">
          {getConfirmationCountdown(booking.lister_confirmation_deadline)}
        </p>
        <div className="mt-auto flex flex-col gap-2">
          <form
            action={
              listerConfirmBooking.bind(null, booking.id) as unknown as (formData: FormData) => Promise<void>
            }
            className="w-full"
          >
            <PendingSubmitButton
              className={cn(
                primaryActionClassName,
                "bg-emerald-600 text-white hover:bg-emerald-700",
              )}
              pendingLabel="Confirming..."
              size="default"
              variant="default"
            >
              Confirm
            </PendingSubmitButton>
          </form>
          <ListerCancelDialog
            booking={booking}
            fullWidth
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
        <p className="text-sm leading-6 text-muted-foreground">
          Confirm handover once the item is with the renter.
        </p>
        <div className="mt-auto flex flex-col gap-2">
          <HandoverDialog
            booking={booking}
            fullWidth
            triggerClassName={cn(
              primaryActionClassName,
              "bg-brand-navy text-white hover:bg-brand-steel",
            )}
            triggerSize="default"
          />
        <Button asChild className={secondaryActionClassName} size="default" variant="outline">
          <Link href="/dashboard/messages">Message renter</Link>
        </Button>
        </div>
      </div>
    );
  }

  if (booking.status === "active") {
    return (
      <div className="flex h-full flex-col gap-3 rounded-3xl border border-border/70 bg-muted/20 p-4 sm:p-5">
        <p className="text-sm leading-6 text-muted-foreground">
          Waiting for the renter to confirm return.
        </p>
        <div className="mt-auto">
          <RaiseDisputeDialog
            bookingId={booking.id}
            buttonClassName={secondaryActionClassName}
            buttonSize="default"
            fullWidth
          />
        </div>
      </div>
    );
  }

  if (booking.status === "returned") {
    return (
      <ConditionCheckForm
        booking={booking}
        fullWidth
        triggerClassName={cn(
          primaryActionClassName,
          "bg-brand-navy text-white hover:bg-brand-steel",
        )}
        triggerSize="default"
      />
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

  if (booking.status === "completed" && booking.lister_reviewed) {
    return (
      <p className="inline-flex min-h-10 w-full items-center rounded-3xl border border-emerald-200 bg-emerald-50/80 px-4 py-3 text-sm font-medium text-emerald-700">
        Review submitted.
      </p>
    );
  }

  return (
    <p className="inline-flex min-h-10 w-full items-center rounded-3xl border border-border/70 bg-muted/20 px-4 py-3 text-sm text-muted-foreground capitalize">
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
  const filteredBookings = sortRequestBookings(
    bookings.filter((booking) => matchesFilter(booking, activeFilter)),
    user.id,
    activeFilter,
  );

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Incoming Bookings</h1>
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
          Confirm paid bookings, handle handover proof, and complete inspections after return.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 rounded-3xl border border-border/70 bg-white/90 p-2 shadow-sm">
        {requestTabs.map((tab) => (
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
                  "overflow-hidden rounded-[28px] border border-border/70 bg-white p-5 shadow-[0_14px_40px_-28px_rgba(15,23,42,0.45)] transition-shadow hover:shadow-[0_18px_44px_-28px_rgba(15,23,42,0.52)]",
                  urgent && "border-red-200 ring-1 ring-red-100",
                )}
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

                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        <span className="rounded-full bg-muted/70 px-3 py-1.5 text-muted-foreground">
                          {formatDuration(booking)} x {booking.quantity} item{booking.quantity === 1 ? "" : "s"}
                        </span>
                        <span className="rounded-full bg-brand-light px-3 py-1.5 font-semibold text-brand-navy">
                          Paid: {formatCurrency(booking.total_price)}
                        </span>
                        <BookingStatusBadge size="sm" status={booking.status} />
                      </div>

                      {urgent ? (
                        <p className="inline-flex items-center gap-2 rounded-full bg-red-100 px-3 py-1.5 text-sm font-medium text-red-700">
                          <AlertTriangle className="size-4" />
                          Priority confirmation required
                        </p>
                      ) : null}

                      <div className="flex flex-wrap items-center gap-3 pt-1">
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

                  <div className="w-full lg:w-[296px] lg:justify-self-end">
                    <RequestActions booking={booking} currentUserId={user.id} />
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
