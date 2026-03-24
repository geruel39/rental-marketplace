import Link from "next/link";
import { addMonths, isAfter, startOfMonth } from "date-fns";
import {
  ArrowRight,
  Boxes,
  Clock3,
  DollarSign,
  ListChecks,
  PackageCheck,
  ShoppingBag,
} from "lucide-react";
import { redirect } from "next/navigation";

import { getIncomingRequests, getMyRentals } from "@/actions/bookings";
import { getInventoryOverview, getLowStockListings } from "@/actions/inventory";
import { LowStockAlert } from "@/components/inventory/low-stock-alert";
import { StockSummaryCard } from "@/components/inventory/stock-summary-card";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { BookingWithDetails } from "@/types";

function isCancelled(status: BookingWithDetails["status"]) {
  return status === "cancelled_by_lister" || status === "cancelled_by_renter";
}

function getDashboardStats(
  inventoryListings: Awaited<ReturnType<typeof getInventoryOverview>>["listings"],
  incomingRequests: BookingWithDetails[],
  rentals: BookingWithDetails[],
) {
  const monthStart = startOfMonth(new Date());
  const nextMonthStart = addMonths(monthStart, 1);

  return {
    lister: {
      activeListings: inventoryListings.filter((listing) => listing.status === "active").length,
      pendingRequests: incomingRequests.filter((booking) => booking.status === "pending").length,
      itemsRentedOut: incomingRequests
        .filter((booking) => booking.status === "confirmed" || booking.status === "active")
        .reduce((sum, booking) => sum + booking.quantity, 0),
      earningsThisMonth: incomingRequests
        .filter((booking) => {
          if (booking.hitpay_payment_status !== "completed") {
            return false;
          }

          const bookingDate = new Date(booking.paid_at ?? booking.created_at);
          return bookingDate >= monthStart && isAfter(nextMonthStart, bookingDate);
        })
        .reduce((sum, booking) => sum + booking.lister_payout, 0),
    },
    renter: {
      activeRentals: rentals.filter(
        (booking) => booking.status === "confirmed" || booking.status === "active",
      ).length,
      pendingRequests: rentals.filter((booking) => booking.status === "pending").length,
      completedRentals: rentals.filter((booking) => booking.status === "completed").length,
    },
  };
}

function DashboardStatCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Card className="border-border/70 shadow-sm">
      <CardContent className="flex items-center justify-between p-6">
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-2xl font-semibold tracking-tight">{value}</p>
        </div>
        <div className="rounded-full bg-muted p-3">
          <Icon className="size-5 text-muted-foreground" />
        </div>
      </CardContent>
    </Card>
  );
}

function RecentBookingList({
  bookings,
  href,
  emptyTitle,
  emptyDescription,
  role,
}: {
  bookings: BookingWithDetails[];
  href: string;
  emptyTitle: string;
  emptyDescription: string;
  role: "lister" | "renter";
}) {
  if (bookings.length === 0) {
    return (
      <EmptyState
        actionHref={href}
        actionLabel="View All"
        description={emptyDescription}
        icon={Clock3}
        title={emptyTitle}
      />
    );
  }

  return (
    <div className="space-y-3">
      {bookings.map((booking) => (
        <article
          key={booking.id}
          className="rounded-2xl border border-border bg-background p-4 shadow-sm"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  className="font-medium transition-colors hover:text-primary hover:underline"
                  href={`/listings/${booking.listing.id}`}
                >
                  {booking.listing.title}
                </Link>
                <Badge variant={isCancelled(booking.status) ? "destructive" : "secondary"}>
                  {booking.status.replaceAll("_", " ")}
                </Badge>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                <span>
                  {role === "lister"
                    ? `Renter: ${booking.renter.display_name || booking.renter.full_name}`
                    : `Host: ${booking.lister.display_name || booking.lister.full_name}`}
                </span>
                <span>
                  {formatDate(booking.start_date)} - {formatDate(booking.end_date)}
                </span>
                <span>x {booking.quantity}</span>
                <span>{formatCurrency(booking.total_price)}</span>
              </div>
            </div>

            <Button asChild size="sm" variant="ghost">
              <Link href={href}>
                View All
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
        </article>
      ))}
    </div>
  );
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [inventoryOverview, lowStockListings, incomingRequests, rentals] =
    await Promise.all([
      getInventoryOverview(user.id),
      getLowStockListings(user.id),
      getIncomingRequests(user.id),
      getMyRentals(user.id),
    ]);

  const stats = getDashboardStats(
    inventoryOverview.listings,
    incomingRequests,
    rentals,
  );

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard Overview</h1>
        <p className="text-sm text-muted-foreground">
          Keep an eye on your listings, inventory, booking requests, and active rentals.
        </p>
      </div>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">As Lister</h2>
          <Button asChild size="sm" variant="ghost">
            <Link href="/dashboard/requests">
              View Requests
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <DashboardStatCard
            icon={ListChecks}
            label="Active Listings"
            value={stats.lister.activeListings}
          />
          <DashboardStatCard
            icon={Clock3}
            label="Pending Requests"
            value={stats.lister.pendingRequests}
          />
          <DashboardStatCard
            icon={Boxes}
            label="Items Rented Out"
            value={stats.lister.itemsRentedOut}
          />
          <DashboardStatCard
            icon={DollarSign}
            label="Earnings This Month"
            value={formatCurrency(stats.lister.earningsThisMonth)}
          />
        </div>

        <StockSummaryCard summary={inventoryOverview.summary} />
        <LowStockAlert listings={lowStockListings} />

        <Card className="border-border/70 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <CardTitle>Recent Booking Requests</CardTitle>
            <Button asChild size="sm" variant="outline">
              <Link href="/dashboard/requests">Manage Requests</Link>
            </Button>
          </CardHeader>
          <CardContent>
            <RecentBookingList
              bookings={incomingRequests.slice(0, 3)}
              emptyDescription="New requests will show up here as renters discover your listings."
              emptyTitle="No recent booking requests"
              href="/dashboard/requests"
              role="lister"
            />
          </CardContent>
        </Card>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">As Renter</h2>
          <Button asChild size="sm" variant="ghost">
            <Link href="/dashboard/my-rentals">
              View Rentals
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <DashboardStatCard
            icon={ShoppingBag}
            label="Active Rentals"
            value={stats.renter.activeRentals}
          />
          <DashboardStatCard
            icon={Clock3}
            label="Pending Requests"
            value={stats.renter.pendingRequests}
          />
          <DashboardStatCard
            icon={PackageCheck}
            label="Completed Rentals"
            value={stats.renter.completedRentals}
          />
        </div>

        <Card className="border-border/70 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <CardTitle>Recent Rental Bookings</CardTitle>
            <Button asChild size="sm" variant="outline">
              <Link href="/dashboard/my-rentals">Manage Rentals</Link>
            </Button>
          </CardHeader>
          <CardContent>
            <RecentBookingList
              bookings={rentals.slice(0, 3)}
              emptyDescription="Booked rentals, payment progress, and completed orders will appear here."
              emptyTitle="No recent rental bookings"
              href="/dashboard/my-rentals"
              role="renter"
            />
          </CardContent>
        </Card>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Quick Actions</h2>
        <div className="flex flex-wrap gap-3">
          <Button asChild>
            <Link href="/listings/new">Create Listing</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/dashboard/inventory">View Inventory</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/listings">Browse Listings</Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
