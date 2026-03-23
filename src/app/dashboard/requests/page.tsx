import { Receipt, Star } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { getIncomingRequests } from "@/actions/bookings";
import { RequestActions } from "@/components/bookings/request-actions";
import { EmptyState } from "@/components/shared/empty-state";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency, formatDate, getInitials } from "@/lib/utils";
import type { BookingStatus, BookingWithDetails } from "@/types";

type SearchParams = Record<string, string | string[] | undefined>;
type RequestTabKey = "all" | "pending" | "confirmed" | "active" | "completed" | "cancelled";

const requestTabs: { key: RequestTabKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "confirmed", label: "Confirmed" },
  { key: "active", label: "Active" },
  { key: "completed", label: "Completed" },
  { key: "cancelled", label: "Cancelled" },
];

function getSingleValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function getRequestTab(value: string | undefined): RequestTabKey {
  if (
    value === "all" ||
    value === "pending" ||
    value === "confirmed" ||
    value === "active" ||
    value === "completed" ||
    value === "cancelled"
  ) {
    return value;
  }

  return "all";
}

function matchesRequestTab(booking: BookingWithDetails, tab: RequestTabKey) {
  if (tab === "all") return true;
  if (tab === "cancelled") {
    return (
      booking.status === "cancelled_by_lister" ||
      booking.status === "cancelled_by_renter"
    );
  }

  return booking.status === tab;
}

function getStatusBadgeVariant(status: BookingStatus) {
  switch (status) {
    case "confirmed":
    case "active":
    case "completed":
      return "default" as const;
    case "cancelled_by_lister":
    case "cancelled_by_renter":
      return "destructive" as const;
    default:
      return "secondary" as const;
  }
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
  const activeTab = getRequestTab(getSingleValue(resolvedSearchParams.status));
  const bookings = await getIncomingRequests(user.id);
  const filteredBookings = bookings.filter((booking) =>
    matchesRequestTab(booking, activeTab),
  );

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Incoming Booking Requests</h1>
        <p className="text-sm text-muted-foreground">
          Review renter requests, confirm stock-backed bookings, and manage active rentals.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 rounded-2xl border border-border bg-background p-2">
        {requestTabs.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <Button
              key={tab.key}
              asChild
              size="sm"
              variant={isActive ? "default" : "ghost"}
            >
              <Link href={`/dashboard/requests?status=${tab.key}`}>{tab.label}</Link>
            </Button>
          );
        })}
      </div>

      {filteredBookings.length === 0 ? (
        <EmptyState
          actionHref="/dashboard/my-listings"
          actionLabel="View My Listings"
          description={`You do not have any ${activeTab} booking requests right now.`}
          icon={Receipt}
          title="No requests in this view"
        />
      ) : (
        <div className="space-y-4">
          {filteredBookings.map((booking) => (
            <article
              key={booking.id}
              className="rounded-2xl border border-border bg-background p-5 shadow-sm"
            >
              <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
                <div className="flex min-w-0 flex-1 gap-4">
                  <Link
                    className="block size-24 shrink-0 overflow-hidden rounded-xl bg-muted transition-opacity hover:opacity-90"
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

                  <div className="min-w-0 flex-1 space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-semibold">
                        <Link
                          className="transition-colors hover:text-primary hover:underline"
                          href={`/listings/${booking.listing.id}`}
                        >
                          {booking.listing.title}
                        </Link>
                      </h2>
                      <Badge variant={getStatusBadgeVariant(booking.status)}>
                        {booking.status.replaceAll("_", " ")}
                      </Badge>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      <Avatar size="lg">
                        <AvatarImage
                          alt={booking.renter.display_name || booking.renter.full_name}
                          src={booking.renter.avatar_url ?? undefined}
                        />
                        <AvatarFallback>
                          {getInitials(
                            booking.renter.display_name || booking.renter.full_name,
                          )}
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

                    <div className="grid gap-3 text-sm text-muted-foreground sm:grid-cols-3">
                      <div>
                        <p className="font-medium text-foreground">Dates</p>
                        <p>
                          {formatDate(booking.start_date)} - {formatDate(booking.end_date)}
                        </p>
                      </div>
                      <div>
                        <p className="font-medium text-foreground">Quantity</p>
                        <p>x {booking.quantity} items</p>
                      </div>
                      <div>
                        <p className="font-medium text-foreground">Total</p>
                        <p>{formatCurrency(booking.total_price)}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <RequestActions booking={booking} />
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
