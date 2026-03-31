import { format } from "date-fns";
import { PackageSearch, Star } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { getMyRentals } from "@/actions/bookings";
import { BookingStatusBadge } from "@/components/bookings/booking-status-badge";
import { RentalActions } from "@/components/bookings/rental-actions";
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

const rentalTabs: Array<{ key: FilterKey; label: string }> = [
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
  return rentalTabs.some((tab) => tab.key === value)
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

interface MyRentalsPageProps {
  searchParams: Promise<SearchParams>;
}

export default async function MyRentalsPage({ searchParams }: MyRentalsPageProps) {
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
  const filteredBookings = bookings.filter((booking) =>
    matchesFilter(booking, activeFilter),
  );

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">My Rentals</h1>
        <p className="text-sm text-muted-foreground">
          Track each booking from approval to return, including payment, delivery, and review steps.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 rounded-2xl border border-border bg-background p-2">
        {rentalTabs.map((tab) => (
          <Button
            key={tab.key}
            asChild
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
          description={`No rentals found in ${rentalTabs.find((tab) => tab.key === activeFilter)?.label ?? "this"} right now.`}
          icon={PackageSearch}
          title="No rentals yet"
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
                          alt={booking.lister.display_name || booking.lister.full_name}
                          src={booking.lister.avatar_url ?? undefined}
                        />
                        <AvatarFallback>
                          {getInitials(booking.lister.display_name || booking.lister.full_name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="space-y-1">
                        <p className="font-medium">
                          {booking.lister.display_name || booking.lister.full_name}
                        </p>
                        <p className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Star className="size-4 fill-current text-amber-500" />
                          {booking.lister.rating_as_lister.toFixed(1)} lister rating
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
                        <p className="font-medium text-foreground">Amount</p>
                        <p>{formatCurrency(booking.total_price)}</p>
                      </div>
                      <div>
                        <p className="font-medium text-foreground">Fulfillment</p>
                        <p>
                          {booking.fulfillment_type === "delivery"
                            ? booking.delivery_city || formatDateTime(booking.delivery_scheduled_at)
                            : formatDateTime(booking.pickup_scheduled_at)}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="xl:w-80">
                  <RentalActions booking={booking} />
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
