import { PackageSearch, Star } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { getMyRentals } from "@/actions/bookings";
import { RentalActions } from "@/components/bookings/rental-actions";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { BookingStatus, BookingWithDetails } from "@/types";

type SearchParams = Record<string, string | string[] | undefined>;
type RentalTabKey = "all" | "pending" | "confirmed" | "active" | "completed" | "cancelled";

const rentalTabs: { key: RentalTabKey; label: string }[] = [
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

function getRentalTab(value: string | undefined): RentalTabKey {
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

function matchesRentalTab(booking: BookingWithDetails, tab: RentalTabKey) {
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
  const activeTab = getRentalTab(getSingleValue(resolvedSearchParams.status));
  const bookings = await getMyRentals(user.id);
  const filteredBookings = bookings.filter((booking) =>
    matchesRentalTab(booking, activeTab),
  );

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">My Rentals</h1>
        <p className="text-sm text-muted-foreground">
          Track your booking requests, upcoming rentals, payments, and completed orders.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 rounded-2xl border border-border bg-background p-2">
        {rentalTabs.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <Button
              key={tab.key}
              asChild
              size="sm"
              variant={isActive ? "default" : "ghost"}
            >
              <Link href={`/dashboard/my-rentals?status=${tab.key}`}>{tab.label}</Link>
            </Button>
          );
        })}
      </div>

      {filteredBookings.length === 0 ? (
        <EmptyState
          actionHref="/listings"
          actionLabel="Browse Listings"
          description="You haven't rented anything yet. Browse listings!"
          icon={PackageSearch}
          title="No rentals yet"
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
                      {booking.hitpay_payment_status === "completed" ? (
                        <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">
                          Paid ✓
                        </Badge>
                      ) : null}
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                      <span>{booking.lister.display_name || booking.lister.full_name}</span>
                      <span className="flex items-center gap-1">
                        <Star className="size-4 fill-current text-amber-500" />
                        {booking.lister.rating_as_lister.toFixed(1)}
                      </span>
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
                        <p className="font-medium text-foreground">Amount</p>
                        <p>{formatCurrency(booking.total_price)}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <RentalActions booking={booking} />
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
