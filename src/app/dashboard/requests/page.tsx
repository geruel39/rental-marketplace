import { format } from "date-fns";
import { Receipt, Star } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { getIncomingRequests } from "@/actions/bookings";
import { BookingStatusBadge } from "@/components/bookings/booking-status-badge";
import { RequestActions } from "@/components/bookings/request-actions";
import { EmptyState } from "@/components/shared/empty-state";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency, getInitials } from "@/lib/utils";
import type { BookingWithDetails } from "@/types";

type SearchParams = Record<string, string | string[] | undefined>;
type FilterKey =
  | "all"
  | "pending"
  | "awaiting_payment"
  | "confirmed"
  | "out_for_delivery"
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
  { key: "out_for_delivery", label: "In Transit" },
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
  return requestTabs.some((tab) => tab.key === value)
    ? (value as FilterKey)
    : "all";
}

function matchesFilter(booking: BookingWithDetails, filter: FilterKey) {
  if (filter === "all") {
    return true;
  }

  if (filter === "cancelled") {
    return (
      booking.status === "cancelled_by_lister" ||
      booking.status === "cancelled_by_renter"
    );
  }

  return booking.status === filter;
}

function formatDateRange(start: string, end: string) {
  const startDate = new Date(start);
  const endDate = new Date(end);

  if (startDate.getFullYear() === endDate.getFullYear()) {
    return `${format(startDate, "MMM d")} - ${format(endDate, "MMM d, yyyy")}`;
  }

  return `${format(startDate, "MMM d, yyyy")} - ${format(endDate, "MMM d, yyyy")}`;
}

function formatDateTime(value?: string | null) {
  if (!value) {
    return "Not scheduled";
  }

  return format(new Date(value), "PPP p");
}

function getFulfillmentBadge(booking: BookingWithDetails) {
  return booking.fulfillment_type === "delivery" ? "🚚 Delivery" : "📦 Pickup";
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
  const filteredBookings = bookings.filter((booking) =>
    matchesFilter(booking, activeFilter),
  );

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Incoming Requests</h1>
        <p className="text-sm text-muted-foreground">
          Review new requests, manage fulfillment, and complete rentals as they move through the booking flow.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 rounded-2xl border border-border bg-background p-2">
        {requestTabs.map((tab) => (
          <Button
            key={tab.key}
            asChild
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
          description={`No bookings found in ${requestTabs.find((tab) => tab.key === activeFilter)?.label ?? "this"} right now.`}
          icon={Receipt}
          title="No incoming bookings"
        />
      ) : (
        <div className="space-y-4">
          {filteredBookings.map((booking) => (
            <article
              key={booking.id}
              className="rounded-3xl border border-border/70 bg-background p-5 shadow-sm"
            >
              <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                <div className="flex min-w-0 flex-1 gap-4">
                  <Link
                    className="block size-24 shrink-0 overflow-hidden rounded-2xl bg-muted transition-opacity hover:opacity-90"
                    href={`/listings/${booking.listing.id}`}
                  >
                    {booking.listing.images[0] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        alt={booking.listing.title}
                        className="h-full w-full object-cover"
                        src={booking.listing.images[0]}
                      />
                    ) : null}
                  </Link>

                  <div className="min-w-0 flex-1 space-y-4">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-lg font-semibold">
                          <Link
                            className="transition-colors hover:text-primary hover:underline"
                            href={`/dashboard/bookings/${booking.id}`}
                          >
                            {booking.listing.title}
                          </Link>
                        </h2>
                        <BookingStatusBadge status={booking.status} />
                        <Badge variant="outline">{getFulfillmentBadge(booking)}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Booking ID: {booking.id.slice(0, 8)}
                      </p>
                      <Link
                        className="inline-flex text-sm font-medium text-primary hover:underline"
                        href={`/dashboard/bookings/${booking.id}`}
                      >
                        View Details -&gt;
                      </Link>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      <Avatar size="lg">
                        <AvatarImage
                          alt={booking.renter.display_name || booking.renter.full_name}
                          src={booking.renter.avatar_url ?? undefined}
                        />
                        <AvatarFallback>
                          {getInitials(booking.renter.display_name || booking.renter.full_name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="space-y-1">
                        <p className="font-medium">
                          {booking.renter.display_name || booking.renter.full_name}
                        </p>
                        <p className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Star className="size-4 fill-current text-amber-500" />
                          {booking.renter.rating_as_renter.toFixed(1)} renter rating
                        </p>
                      </div>
                    </div>

                    <div className="grid gap-3 text-sm text-muted-foreground sm:grid-cols-2 lg:grid-cols-4">
                      <div>
                        <p className="font-medium text-foreground">Dates</p>
                        <p>{formatDateRange(booking.start_date, booking.end_date)}</p>
                      </div>
                      <div>
                        <p className="font-medium text-foreground">Quantity</p>
                        <p>× {booking.quantity} items</p>
                      </div>
                      <div>
                        <p className="font-medium text-foreground">Fulfillment</p>
                        <p>
                          {booking.fulfillment_type === "delivery"
                            ? booking.delivery_city || "Delivery"
                            : formatDateTime(booking.pickup_scheduled_at)}
                        </p>
                      </div>
                      <div>
                        <p className="font-medium text-foreground">Total</p>
                        <p>{formatCurrency(booking.total_price)}</p>
                      </div>
                    </div>

                    <details className="rounded-2xl border border-border/70 bg-muted/20 p-4 text-sm">
                      <summary className="cursor-pointer font-medium text-foreground">
                        View price breakdown
                      </summary>
                      <div className="mt-3 space-y-2 text-muted-foreground">
                        <div className="flex items-center justify-between">
                          <span>Subtotal</span>
                          <span>{formatCurrency(booking.subtotal)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Service fee</span>
                          <span>{formatCurrency(booking.service_fee_renter)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Deposit</span>
                          <span>{formatCurrency(booking.deposit_amount)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Delivery fee</span>
                          <span>{formatCurrency(booking.delivery_fee)}</span>
                        </div>
                      </div>
                    </details>
                  </div>
                </div>

                <div className="xl:w-80">
                  <RequestActions booking={booking} />
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
