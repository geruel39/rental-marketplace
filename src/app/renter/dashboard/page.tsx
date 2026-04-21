import { formatDistanceToNow } from "date-fns";
import Link from "next/link";
import { redirect } from "next/navigation";

import { getNotifications } from "@/actions/notifications";
import { getListingEligibility } from "@/actions/verification";
import { BookingStatusBadge } from "@/components/bookings/booking-status-badge";
import { NotificationList } from "@/components/notifications/notification-list";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import type { Booking, Listing, Profile } from "@/types";

type RentalRow = Booking & {
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

export default async function RenterDashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [profileResult, eligibility, activeCountResult, awaitingCountResult, completedCountResult, rentalsResult, notifications] =
    await Promise.all([
      supabase.from("profiles").select("*").eq("id", user.id).maybeSingle<Profile>(),
      getListingEligibility(user.id),
      supabase
        .from("bookings")
        .select("id", { count: "exact", head: true })
        .eq("renter_id", user.id)
        .in("status", ["lister_confirmation", "confirmed", "active"]),
      supabase
        .from("bookings")
        .select("id", { count: "exact", head: true })
        .eq("renter_id", user.id)
        .eq("status", "lister_confirmation"),
      supabase
        .from("bookings")
        .select("id", { count: "exact", head: true })
        .eq("renter_id", user.id)
        .eq("status", "completed"),
      supabase
        .from("bookings")
        .select(
          "*, listing:listings!bookings_listing_id_fkey(id, title, images)",
        )
        .eq("renter_id", user.id)
        .in("status", ["lister_confirmation", "confirmed", "active"])
        .order("created_at", { ascending: false })
        .limit(5),
      getNotifications(user.id, 1),
    ]);

  if (!profileResult.data) {
    redirect("/login");
  }

  const profile = profileResult.data;
  const displayName = profile.display_name || profile.full_name || user.email || "there";
  const activeRentals = (rentalsResult.data ?? []) as RentalRow[];

  return (
    <div className="space-y-8">
      <section className="space-y-2">
        <p className="text-sm text-muted-foreground">Renter Dashboard</p>
        <h1 className="text-3xl font-semibold tracking-tight">
          Welcome back, {displayName}
        </h1>
      </section>

      {profile.account_type === "individual" && !eligibility.allowed ? (
        <Alert className="border-orange-200 bg-orange-50 text-orange-950">
          <AlertTitle>Want to earn?</AlertTitle>
          <AlertDescription className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span>
              Verify your account to become a lister too.
            </span>
            <Button asChild className="bg-brand-navy text-white hover:bg-brand-steel" size="sm">
              <Link href="/account/verify">Verify Account</Link>
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      <section className="grid gap-4 md:grid-cols-3">
        <DashboardCard
          label="Active Rentals"
          value={activeCountResult.count ?? 0}
        />
        <DashboardCard
          label="Awaiting Confirmation"
          value={awaitingCountResult.count ?? 0}
        />
        <DashboardCard
          label="Completed Rentals"
          value={completedCountResult.count ?? 0}
        />
      </section>

      <section className="space-y-4">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">Active Rentals</h2>
          <p className="text-sm text-muted-foreground">
            Track current bookings and watch for lister confirmations.
          </p>
        </div>
        <div className="space-y-3">
          {activeRentals.length === 0 ? (
            <Card className="border-dashed border-border/70 bg-background">
              <CardContent className="p-6 text-sm text-muted-foreground">
                No active rentals right now. Browse listings to book something new.
              </CardContent>
            </Card>
          ) : (
            activeRentals.map((booking) => (
              <Card className="border-border/70 shadow-sm" key={booking.id}>
                <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-start gap-4">
                    <div className="size-16 overflow-hidden rounded-xl bg-muted">
                      {booking.listing?.images?.[0] ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          alt={booking.listing.title}
                          className="h-full w-full object-cover"
                          src={booking.listing.images[0]}
                        />
                      ) : null}
                    </div>
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">
                          {booking.listing?.title ?? `Booking #${booking.id.slice(0, 8)}`}
                        </p>
                        <BookingStatusBadge size="sm" status={booking.status} />
                      </div>
                      {booking.status === "lister_confirmation" &&
                      booking.lister_confirmation_deadline ? (
                        <p className="text-sm text-red-700">
                          Lister has until{" "}
                          {formatDistanceToNow(
                            new Date(booking.lister_confirmation_deadline),
                            { addSuffix: true },
                          )}{" "}
                          to confirm
                        </p>
                      ) : null}
                    </div>
                  </div>
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/renter/rentals/${booking.id}`}>View Details</Link>
                  </Button>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </section>

      <section className="space-y-4">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">Quick Actions</h2>
          <p className="text-sm text-muted-foreground">
            Jump back into browsing or review your rentals.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <Button asChild className="bg-brand-navy text-white hover:bg-brand-steel">
            <Link href="/listings">Browse Items</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/renter/rentals">My Rentals</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/renter/favorites">Favorites</Link>
          </Button>
        </div>
      </section>

      <section className="space-y-4">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">Recent Activity</h2>
          <p className="text-sm text-muted-foreground">
            Your latest renter-side notifications and updates.
          </p>
        </div>
        <NotificationList compact notifications={notifications.data.slice(0, 5)} />
      </section>
    </div>
  );
}
