import { format } from "date-fns";
import { Receipt, Star } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import {
  acceptBookingRequest,
  cancelBooking,
  declineBookingRequest,
  getIncomingRequests,
} from "@/actions/bookings";
import { BookingStatusBadge } from "@/components/bookings/booking-status-badge";
import { ConditionCheckForm } from "@/components/bookings/condition-check-form";
import { HandoverDialog } from "@/components/bookings/handover-dialog";
import { PaymentCountdown } from "@/components/bookings/payment-countdown";
import { RaiseDisputeDialog } from "@/components/bookings/raise-dispute-dialog";
import { RentalCountdown } from "@/components/bookings/rental-countdown";
import { ReviewActionButton } from "@/components/reviews/review-action-button";
import { EmptyState } from "@/components/shared/empty-state";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { cn, formatCurrency, getInitials } from "@/lib/utils";
import type { BookingStatus, BookingWithDetails } from "@/types";

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

const requestTabs: Array<{ key: FilterKey; label: string }> = [
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
  return requestTabs.some((tab) => tab.key === value) ? (value as FilterKey) : "all";
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
      return "No pending requests. New booking requests will appear here.";
    case "awaiting_payment":
      return "No requests are waiting for renter payment.";
    case "confirmed":
      return "No confirmed bookings waiting for handover.";
    case "active":
      return "No active rentals right now.";
    case "returned":
      return "No returned rentals waiting for inspection.";
    case "completed":
      return "No completed bookings in this view.";
    case "cancelled":
      return "No cancelled bookings in this view.";
    case "disputed":
      return "No disputed bookings right now.";
    default:
      return "No incoming bookings yet.";
  }
}

function formatDuration(booking: BookingWithDetails) {
  const units = booking.rental_units || booking.num_units || 1;
  const period = booking.pricing_period;
  return `${units} ${period}${units === 1 ? "" : "s"}`;
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

function statusTitle(status: BookingStatus) {
  return status.replaceAll("_", " ");
}

function RequestActions({ booking }: { booking: BookingWithDetails }) {
  if (booking.status === "pending") {
    return (
      <div className="flex flex-wrap items-center justify-end gap-2">
        <form
          action={
            acceptBookingRequest.bind(null, booking.id) as unknown as (formData: FormData) => Promise<void>
          }
        >
          <Button className="bg-brand-navy text-white hover:bg-brand-steel" size="sm" type="submit">
            Accept
          </Button>
        </form>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button size="sm" variant="outline">
              Decline
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Decline this booking request?</AlertDialogTitle>
              <AlertDialogDescription>
                This will cancel the request and notify the renter.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Back</AlertDialogCancel>
              <form
                action={
                  declineBookingRequest.bind(
                    null,
                    booking.id,
                    "Declined by lister",
                  ) as unknown as (formData: FormData) => Promise<void>
                }
              >
                <Button type="submit" variant="destructive">
                  Confirm Decline
                </Button>
              </form>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }

  if (booking.status === "awaiting_payment") {
    const isExpired =
      booking.payment_expires_at && new Date(booking.payment_expires_at).getTime() <= Date.now();

    return (
      <div className="space-y-2 text-right">
        <p className="text-sm text-muted-foreground">Waiting for payment</p>
        {booking.payment_expires_at ? (
          <div className="inline-flex">
            <PaymentCountdown expiresAt={booking.payment_expires_at} />
          </div>
        ) : null}
        {isExpired ? (
          <form
            action={
              cancelBooking.bind(
                null,
                booking.id,
                "Payment window expired.",
              ) as unknown as (formData: FormData) => Promise<void>
            }
          >
            <Button size="sm" variant="outline">
              Cancel
            </Button>
          </form>
        ) : null}
      </div>
    );
  }

  if (booking.status === "confirmed") {
    return (
      <div className="flex justify-end">
        <HandoverDialog booking={booking} />
      </div>
    );
  }

  if (booking.status === "active") {
    return (
      <div className="space-y-2 text-right">
        <p className="text-sm text-muted-foreground">
          {booking.returned_at ? "Return was submitted" : "Waiting for renter to return"}
        </p>
        <div className="flex justify-end">
          <RaiseDisputeDialog bookingId={booking.id} buttonSize="sm" />
        </div>
      </div>
    );
  }

  if (booking.status === "returned") {
    return (
      <div className="space-y-3">
        <div className="flex justify-end">
          <ConditionCheckForm booking={booking} />
        </div>
        {booking.return_proof_urls.length > 0 ? (
          <div className="grid grid-cols-4 gap-2">
            {booking.return_proof_urls.slice(0, 4).map((url) => (
              <a href={url} key={url} rel="noreferrer" target="_blank">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img alt="Return proof" className="h-12 w-full rounded-md border object-cover" src={url} />
              </a>
            ))}
          </div>
        ) : null}
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
        <ReviewActionButton booking={booking} currentUserId={booking.lister_id} size="sm" />
        <p className="text-xs text-muted-foreground">
          Payout: {booking.payout_at ? `Processed ${format(new Date(booking.payout_at), "PPP")}` : "Pending"}
        </p>
      </div>
    );
  }

  return (
    <p className="text-right text-sm text-muted-foreground capitalize">
      {statusTitle(booking.status)}
    </p>
  );
}

interface RequestsPageProps {
  searchParams: Promise<SearchParams>;
}

export default async function RequestsPage({ searchParams }: RequestsPageProps) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const resolvedSearchParams = await searchParams;
  const activeFilter = getFilter(getSingleValue(resolvedSearchParams.status));
  const bookings = await getIncomingRequests(user.id);
  const filteredBookings = bookings.filter((booking) => matchesFilter(booking, activeFilter));

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Incoming Requests</h1>
        <p className="text-sm text-muted-foreground">
          Review requests, confirm handover with photo proof, and complete inspections after return.
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
          description={getEmptyDescription(activeFilter)}
          icon={Receipt}
          title="No incoming bookings"
        />
      ) : (
        <div className="space-y-4">
          {filteredBookings.map((booking) => {
            const renterName = booking.renter.display_name || booking.renter.full_name;

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
                      <p className="text-xs text-muted-foreground">Booking #{booking.id.slice(0, 8)}</p>

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

                      <Link
                        className="inline-flex text-sm font-medium text-brand-navy hover:underline"
                        href={`/dashboard/bookings/${booking.id}`}
                      >
                        View Details →
                      </Link>
                    </div>
                  </div>

                  <div className="w-full lg:w-[280px]">
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
