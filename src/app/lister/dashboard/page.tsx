import { format, formatDistanceToNow } from "date-fns";
import Link from "next/link";
import { redirect } from "next/navigation";

import { getInventoryOverview } from "@/actions/inventory";
import { getListingEligibility } from "@/actions/verification";
import { BookingStatusBadge } from "@/components/bookings/booking-status-badge";
import { StockSummaryCard } from "@/components/inventory/stock-summary-card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency } from "@/lib/utils";
import type { Booking, Listing, Profile } from "@/types";

type BookingRow = Booking & {
  listing: Pick<Listing, "id" | "title" | "images"> | null;
};

function DashboardCard({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <Card className="border-border/70 shadow-sm">
      <CardContent className="space-y-2 p-5">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="text-3xl font-semibold tracking-tight">{value}</p>
      </CardContent>
    </Card>
  );
}

export default async function ListerDashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const [profileResult, eligibility, inventory, listingsResult, confirmResult, activeRentalsResult, payoutsResult, bookingsResult] =
    await Promise.all([
      supabase.from("profiles").select("*").eq("id", user.id).maybeSingle<Profile>(),
      getListingEligibility(user.id),
      getInventoryOverview(user.id),
      supabase
        .from("listings")
        .select("id", { count: "exact", head: true })
        .eq("owner_id", user.id)
        .eq("status", "active"),
      supabase
        .from("bookings")
        .select("id, lister_confirmation_deadline", { count: "exact" })
        .eq("lister_id", user.id)
        .eq("status", "lister_confirmation")
        .order("lister_confirmation_deadline", { ascending: true }),
      supabase
        .from("bookings")
        .select("id", { count: "exact", head: true })
        .eq("lister_id", user.id)
        .in("status", ["confirmed", "active", "returned"]),
      supabase
        .from("payouts")
        .select("amount, net_amount")
        .eq("lister_id", user.id)
        .eq("status", "completed")
        .gte("created_at", monthStart.toISOString()),
      supabase
        .from("bookings")
        .select(
          "*, listing:listings!bookings_listing_id_fkey(id, title, images)",
        )
        .eq("lister_id", user.id)
        .order("created_at", { ascending: false })
        .limit(5),
    ]);

  if (!profileResult.data) {
    redirect("/login");
  }

  const displayName =
    profileResult.data.display_name ||
    profileResult.data.full_name ||
    user.email ||
    "there";
  const confirmationBookings = (confirmResult.data ?? []) as Array<Pick<
    Booking,
    "id" | "lister_confirmation_deadline"
  >>;
  const earliestDeadline = confirmationBookings[0]?.lister_confirmation_deadline;
  const monthlyEarnings = ((payoutsResult.data ?? []) as Array<{
    amount: number | null;
    net_amount?: number | null;
  }>).reduce(
    (sum, payout) => sum + (payout.net_amount ?? payout.amount ?? 0),
    0,
  );
  const recentBookings = ((bookingsResult.data ?? []) as BookingRow[]) ?? [];
  const hasInventoryAlert =
    inventory.summary.lowStockCount > 0 || inventory.summary.outOfStockCount > 0;

  return (
    <div className="space-y-8">
      <section className="space-y-2">
        <p className="text-sm text-muted-foreground">Lister Dashboard</p>
        <h1 className="text-3xl font-semibold tracking-tight">
          Welcome back, {displayName}
        </h1>
      </section>

      {!eligibility.allowed ? (
        <Alert className="border-orange-200 bg-orange-50 text-orange-950">
          <AlertTitle>Complete verification to start listing</AlertTitle>
          <AlertDescription className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span>
              {eligibility.message ||
                "Finish your account verification before publishing or managing listings."}
            </span>
            <Button asChild className="bg-brand-navy text-white hover:bg-brand-steel" size="sm">
              <Link href="/account/verify">Open Verification</Link>
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      {confirmationBookings.length > 0 ? (
        <Alert className="border-red-200 bg-red-50 text-red-950">
          <AlertTitle>
            {confirmationBookings.length} booking(s) need your confirmation
          </AlertTitle>
          <AlertDescription className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span>
              Confirm now
              {earliestDeadline
                ? ` — deadline: ${format(new Date(earliestDeadline), "PP p")}`
                : ""}
            </span>
            <Button asChild size="sm" variant="destructive">
              <Link href="/lister/bookings">Confirm Now</Link>
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <DashboardCard
          label="Active Listings"
          value={listingsResult.count ?? 0}
        />
        <DashboardCard
          label="Bookings to Confirm"
          value={confirmResult.count ?? 0}
        />
        <DashboardCard
          label="Active Rentals"
          value={activeRentalsResult.count ?? 0}
        />
        <DashboardCard
          label="Earnings This Month"
          value={formatCurrency(monthlyEarnings)}
        />
      </section>

      <section className="space-y-4">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">Inventory Health</h2>
          <p className="text-sm text-muted-foreground">
            Watch low-stock and out-of-stock listings before they affect bookings.
          </p>
        </div>

        {hasInventoryAlert ? (
          <Alert className="border-amber-200 bg-amber-50 text-amber-950">
            <AlertDescription>
              {inventory.summary.outOfStockCount > 0
                ? `${inventory.summary.outOfStockCount} listing(s) are out of stock. `
                : ""}
              {inventory.summary.lowStockCount > 0
                ? `${inventory.summary.lowStockCount} listing(s) are running low.`
                : ""}
            </AlertDescription>
          </Alert>
        ) : null}

        <StockSummaryCard summary={inventory.summary} />
      </section>

      <section className="space-y-4">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">Quick Actions</h2>
          <p className="text-sm text-muted-foreground">
            Jump into your most common lister tasks.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <Button asChild className="bg-brand-navy text-white hover:bg-brand-steel">
            <Link href="/lister/listings/new">Create New Listing</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/lister/listings">Manage Listings</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/lister/earnings">View Earnings</Link>
          </Button>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">Recent Bookings</h2>
            <p className="text-sm text-muted-foreground">
              Your latest incoming booking activity.
            </p>
          </div>
          <Button asChild size="sm" variant="outline">
            <Link href="/lister/bookings">View All</Link>
          </Button>
        </div>

        <div className="space-y-3">
          {recentBookings.length === 0 ? (
            <Card className="border-dashed border-border/70 bg-background">
              <CardContent className="p-6 text-sm text-muted-foreground">
                No bookings yet. Once renters place orders, they&apos;ll show up here.
              </CardContent>
            </Card>
          ) : (
            recentBookings.map((booking) => (
              <Card className="border-border/70 shadow-sm" key={booking.id}>
                <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        className="font-medium hover:text-brand-navy hover:underline"
                        href={`/lister/bookings/${booking.id}`}
                      >
                        {booking.listing?.title ?? `Booking #${booking.id.slice(0, 8)}`}
                      </Link>
                      <BookingStatusBadge size="sm" status={booking.status} />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Created {format(new Date(booking.created_at), "PP p")}
                    </p>
                    {booking.status === "lister_confirmation" &&
                    booking.lister_confirmation_deadline ? (
                      <p className="text-sm text-red-700">
                        Confirm within{" "}
                        {formatDistanceToNow(
                          new Date(booking.lister_confirmation_deadline),
                          { addSuffix: true },
                        )}
                      </p>
                    ) : null}
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-brand-navy">
                      {formatCurrency(booking.total_price)}
                    </p>
                    <Button asChild className="mt-2" size="sm" variant="outline">
                      <Link href={`/lister/bookings/${booking.id}`}>View</Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
