import Link from "next/link";
import { Suspense } from "react";
import { format } from "date-fns";
import {
  AlertTriangle,
  ArrowRight,
  Building,
  Clock3,
  CreditCard,
  DollarSign,
  Package,
  PackageCheck,
  ShoppingBag,
  Smartphone,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { redirect } from "next/navigation";

import { getIncomingRequests, getMyRentals } from "@/actions/bookings";
import { getDashboardStats } from "@/actions/profile";
import { BookingStatusBadge } from "@/components/bookings/booking-status-badge";
import { RentalCountdown } from "@/components/bookings/rental-countdown";
import { LowStockAlert } from "@/components/inventory/low-stock-alert";
import { StockSummaryCard } from "@/components/inventory/stock-summary-card";
import { NotificationList } from "@/components/notifications/notification-list";
import { PayoutMethodBadge } from "@/components/payout/payout-method-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { cn, formatCurrency, getInitials } from "@/lib/utils";
import type { BookingWithDetails, DashboardStats, Profile } from "@/types";

interface StatsSectionProps {
  statsPromise: Promise<DashboardStats>;
}

function DashboardMetricCard({
  label,
  value,
  icon: Icon,
  href,
  linkLabel = "View",
}: {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  href?: string;
  linkLabel?: string;
}) {
  return (
    <Card className="border-border/70 shadow-sm">
      <CardContent className="space-y-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="text-3xl font-semibold tracking-tight">{value}</p>
          </div>
          <div className="rounded-2xl bg-muted p-3">
            <Icon className="size-5 text-muted-foreground" />
          </div>
        </div>
        {href ? (
          <Button asChild className="px-0" size="sm" variant="link">
            <Link href={href}>
              {linkLabel}
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}

function SectionSkeleton({
  cards = 3,
  rows = 3,
}: {
  cards?: number;
  rows?: number;
}) {
  return (
    <div className="space-y-4">
      <div className="h-7 w-40 rounded-md bg-accent" />
      <div
        className={cn(
          "grid gap-4 md:grid-cols-2",
          cards === 4 ? "xl:grid-cols-4" : "xl:grid-cols-3",
        )}
      >
        {Array.from({ length: cards }).map((_, index) => (
          <div
            key={index}
            className="rounded-3xl border border-border/70 bg-background p-5 shadow-sm"
          >
            <div className="h-4 w-28 rounded-md bg-accent" />
            <div className="mt-4 h-8 w-20 rounded-md bg-accent" />
            <div className="mt-6 h-4 w-24 rounded-md bg-accent" />
          </div>
        ))}
      </div>
      <div className="rounded-3xl border border-border/70 bg-background p-5 shadow-sm">
        {Array.from({ length: rows }).map((_, index) => (
          <div key={index} className={index === 0 ? "" : "mt-4"}>
            <div className="h-4 w-56 rounded-md bg-accent" />
            <div className="mt-2 h-4 w-40 rounded-md bg-accent" />
          </div>
        ))}
      </div>
    </div>
  );
}

function AlertsSkeleton() {
  return (
    <div className="space-y-4">
      <div className="rounded-3xl border border-border/70 bg-background p-5 shadow-sm">
        <div className="h-5 w-52 rounded-md bg-accent" />
        <div className="mt-3 h-4 w-72 rounded-md bg-accent" />
      </div>
      <div className="rounded-3xl border border-border/70 bg-background p-5 shadow-sm">
        <div className="h-5 w-44 rounded-md bg-accent" />
        <div className="mt-3 h-4 w-64 rounded-md bg-accent" />
      </div>
    </div>
  );
}

function NotificationsSkeleton() {
  return (
    <div className="space-y-4">
      <div className="h-7 w-44 rounded-md bg-accent" />
      <div className="rounded-3xl border border-border/70 bg-background p-5 shadow-sm">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className={index === 0 ? "" : "mt-4"}>
            <div className="h-4 w-48 rounded-md bg-accent" />
            <div className="mt-2 h-4 w-64 rounded-md bg-accent" />
          </div>
        ))}
      </div>
    </div>
  );
}

function QuickActionsSection() {
  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">Quick Actions</h2>
        <p className="text-sm text-muted-foreground">
          Jump into the tasks you use most often.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Button asChild className="bg-brand-navy text-white hover:bg-brand-steel">
          <Link href="/listings/new">Create Listing</Link>
        </Button>
        <Button asChild className="border-brand-navy/15 bg-white text-brand-navy hover:bg-brand-light hover:text-brand-navy" variant="outline">
          <Link href="/dashboard/inventory">Manage Inventory</Link>
        </Button>
        <Button asChild className="border-brand-navy/15 bg-white text-brand-navy hover:bg-brand-light hover:text-brand-navy" variant="outline">
          <Link href="/listings">Browse Listings</Link>
        </Button>
      </div>
    </section>
  );
}

function BookingList({
  bookings,
  href,
  emptyTitle,
  emptyDescription,
  currentUserId,
}: {
  bookings: BookingWithDetails[];
  href: string;
  emptyTitle: string;
  emptyDescription: string;
  currentUserId: string;
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
        <div
          className="rounded-2xl border border-border/70 bg-background p-3 shadow-sm"
          key={booking.id}
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Link className="line-clamp-1 font-medium hover:text-brand-navy hover:underline" href={`/dashboard/bookings/${booking.id}`}>
                  {booking.listing.title}
                </Link>
                <BookingStatusBadge size="sm" status={booking.status} />
              </div>
              <p className="text-sm text-muted-foreground">
                {(booking.rental_units || booking.num_units || 1)} {booking.pricing_period}
                {(booking.rental_units || booking.num_units || 1) === 1 ? "" : "s"} x {booking.quantity}
              </p>
              {booking.status === "active" && booking.rental_ends_at && booking.rental_started_at ? (
                <RentalCountdown
                  rentalEndsAt={booking.rental_ends_at}
                  rentalStartedAt={booking.rental_started_at}
                  variant="compact"
                />
              ) : null}
            </div>
            <div className="text-right">
              <p className="font-semibold text-brand-navy">{formatCurrency(booking.total_price)}</p>
              <p className="text-xs text-muted-foreground">Booking #{booking.id.slice(0, 8)}</p>
            </div>
          </div>

          <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
            <Avatar size="sm">
              <AvatarImage
                alt="Counterparty avatar"
                src={(booking.renter_id === currentUserId ? booking.lister.avatar_url : booking.renter.avatar_url) ?? undefined}
              />
              <AvatarFallback>
                {getInitials(
                  booking.renter_id === currentUserId
                    ? booking.lister.display_name || booking.lister.full_name
                    : booking.renter.display_name || booking.renter.full_name,
                )}
              </AvatarFallback>
            </Avatar>
            <span>
              {booking.renter_id === currentUserId
                ? booking.lister.display_name || booking.lister.full_name
                : booking.renter.display_name || booking.renter.full_name}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

async function ActionRequiredSection({
  incomingRequestsPromise,
  myRentalsPromise,
  userId,
}: {
  incomingRequestsPromise: Promise<BookingWithDetails[]>;
  myRentalsPromise: Promise<BookingWithDetails[]>;
  userId: string;
}) {
  const [incomingRequests, myRentals] = await Promise.all([
    incomingRequestsPromise,
    myRentalsPromise,
  ]);
  const actionItems = [
    ...incomingRequests
      .filter(
        (booking) =>
          booking.status === "pending" ||
          booking.status === "confirmed" ||
          booking.status === "returned",
      )
      .slice(0, 3)
      .map((booking) => ({
        booking,
        label:
          booking.status === "pending"
            ? "Review request"
            : booking.status === "confirmed"
              ? "Confirm handover"
              : "Inspect returned item",
      })),
    ...myRentals
      .filter((booking) => {
        if (booking.status === "awaiting_payment") return true;
        if (
          booking.status === "active" &&
          booking.rental_ends_at &&
          booking.rental_started_at
        ) {
          const total = Math.max(
            1,
            new Date(booking.rental_ends_at).getTime() -
              new Date(booking.rental_started_at).getTime(),
          );
          const remaining = new Date(booking.rental_ends_at).getTime() - Date.now();
          return remaining > 0 && remaining / total < 0.2;
        }
        return false;
      })
      .slice(0, 3)
      .map((booking) => ({
        booking,
        label:
          booking.status === "awaiting_payment"
            ? "Complete payment"
            : "Return item soon",
      })),
  ].slice(0, 6);

  if (actionItems.length === 0) {
    return null;
  }

  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">Action Required</h2>
        <p className="text-sm text-muted-foreground">
          Bookings waiting on your next step.
        </p>
      </div>
      <div className="space-y-3">
        {actionItems.map(({ booking, label }) => (
          <div
            key={booking.id}
            className="rounded-2xl border border-border/70 bg-background p-3 shadow-sm"
          >
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">{booking.listing.title}</p>
                  <BookingStatusBadge size="sm" status={booking.status} />
                </div>
                <p className="text-sm text-muted-foreground">
                  {(booking.rental_units || booking.num_units || 1)} {booking.pricing_period}
                  {(booking.rental_units || booking.num_units || 1) === 1 ? "" : "s"} x {booking.quantity}
                </p>
                {booking.status === "active" && booking.rental_ends_at && booking.rental_started_at ? (
                  <RentalCountdown
                    rentalEndsAt={booking.rental_ends_at}
                    rentalStartedAt={booking.rental_started_at}
                    variant="compact"
                  />
                ) : null}
              </div>
              <Button asChild className="shrink-0">
                <Link href={`/dashboard/bookings/${booking.id}`}>{label}</Link>
              </Button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

async function DashboardAlertsSection({ statsPromise }: StatsSectionProps) {
  const stats = await statsPromise;

  if (stats.lister.lowStockListings.length === 0 && stats.pendingReviewsCount === 0) {
    return null;
  }

  return (
    <section className="space-y-4">
      {stats.lister.lowStockListings.length > 0 ? (
        <LowStockAlert listings={stats.lister.lowStockListings} />
      ) : null}

      {stats.pendingReviewsCount > 0 ? (
        <Card className="border-border/70 shadow-sm">
          <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <p className="font-semibold">
                You have {stats.pendingReviewsCount} booking
                {stats.pendingReviewsCount === 1 ? "" : "s"} to review
              </p>
              <p className="text-sm text-muted-foreground">
                Leave reviews to build trust on both sides of the marketplace.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {stats.pendingReviewsAsRenter > 0 ? (
                <Button asChild>
                  <Link href="/dashboard/my-rentals">Open My Rentals</Link>
                </Button>
              ) : null}
              {stats.pendingReviewsAsLister > 0 ? (
                <Button asChild variant="outline">
                  <Link href="/dashboard/requests">Open Requests</Link>
                </Button>
              ) : null}
            </div>
          </CardContent>
        </Card>
      ) : null}
    </section>
  );
}

async function ListerSection({
  statsPromise,
  userId,
  profile,
}: StatsSectionProps & { userId: string; profile: Profile | null }) {
  const stats = await statsPromise;
  const payoutMethod = profile?.payout_method;
  const hasListerActivity =
    stats.lister.totalListings > 0 || stats.lister.totalEarnings > 0;
  const payoutConfigured = Boolean(
    profile &&
      ((payoutMethod === "gcash" && profile.gcash_phone_number) ||
        (payoutMethod === "maya" && profile.maya_phone_number) ||
        (payoutMethod === "bank" &&
          profile.bank_name &&
          profile.bank_account_number &&
          profile.bank_account_name &&
          profile.bank_kyc_verified) ||
        profile.payout_setup_completed),
  );
  const showPayoutSetupCard = hasListerActivity && !payoutConfigured;

  function getPayoutIcon() {
    switch (payoutMethod) {
      case "bank":
        return Building;
      case "gcash":
        return Smartphone;
      case "maya":
        return CreditCard;
      default:
        return Wallet;
    }
  }

  const PayoutIcon = getPayoutIcon();

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">As Lister</h2>
          <p className="text-sm text-muted-foreground">
            Monitor listing health, requests, and earnings at a glance.
          </p>
        </div>
      </div>

      <div
        className={cn(
          "grid gap-4 md:grid-cols-2",
          showPayoutSetupCard ? "xl:grid-cols-5" : "xl:grid-cols-4",
        )}
      >
        <DashboardMetricCard
          href="/dashboard/my-listings"
          icon={Package}
          label="Active Listings"
          linkLabel="View All"
          value={stats.lister.activeListings}
        />
        <DashboardMetricCard
          href="/dashboard/requests"
          icon={Clock3}
          label="Pending Requests"
          value={stats.lister.pendingRequests}
        />
        <DashboardMetricCard
          icon={TrendingUp}
          label="Items Rented Out"
          value={stats.lister.itemsRentedOut}
        />
        <DashboardMetricCard
          icon={DollarSign}
          label="Earnings This Month"
          value={formatCurrency(stats.lister.earningsThisMonth)}
        />
        {showPayoutSetupCard ? (
          <Card className="border-border/70 shadow-sm">
            <CardContent className="space-y-4 p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Payout Method</p>
                  <p className="font-semibold text-amber-900">Payout setup required</p>
                  <p className="text-sm text-muted-foreground">
                    You must set up payout to create listings.
                  </p>
                </div>
                <div className="rounded-2xl bg-amber-100 p-3">
                  <AlertTriangle className="size-5 text-amber-700" />
                </div>
              </div>
              <Button asChild className="bg-brand-navy text-white hover:bg-brand-steel" size="sm">
                <Link href="/dashboard/settings/payments">
                  Set Up Now
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : null}
      </div>

      <StockSummaryCard summary={stats.lister.inventorySummary} />

      <Card className="border-border/70 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle>Recent Booking Requests</CardTitle>
          <Button asChild size="sm" variant="outline">
            <Link href="/dashboard/requests">View All Requests</Link>
          </Button>
        </CardHeader>
        <CardContent>
          <BookingList
            bookings={stats.lister.recentIncomingRequests.slice(0, 3)}
            emptyDescription="New renter requests will appear here as soon as they come in."
            emptyTitle="No recent booking requests"
            href="/dashboard/requests"
            currentUserId={userId}
          />
        </CardContent>
      </Card>
    </section>
  );
}

async function RenterSection({
  statsPromise,
  userId,
}: StatsSectionProps & { userId: string }) {
  const stats = await statsPromise;

  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">As Renter</h2>
        <p className="text-sm text-muted-foreground">
          Track your outgoing requests, active rentals, and completed bookings.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <DashboardMetricCard
          icon={ShoppingBag}
          label="Active Rentals"
          value={stats.renter.activeRentals}
        />
        <DashboardMetricCard
          icon={Clock3}
          label="Pending Requests"
          value={stats.renter.pendingRequests}
        />
        <DashboardMetricCard
          icon={PackageCheck}
          label="Completed Rentals"
          value={stats.renter.completedRentals}
        />
      </div>

      <Card className="border-border/70 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle>Recent Rentals</CardTitle>
          <Button asChild size="sm" variant="outline">
            <Link href="/dashboard/my-rentals">View All Rentals</Link>
          </Button>
        </CardHeader>
        <CardContent>
          <BookingList
            bookings={stats.renter.recentRentals.slice(0, 3)}
            emptyDescription="Your latest booking activity will show up here."
            emptyTitle="No recent rentals"
            href="/dashboard/my-rentals"
            currentUserId={userId}
          />
        </CardContent>
      </Card>
    </section>
  );
}

async function NotificationsSection({ statsPromise }: StatsSectionProps) {
  const stats = await statsPromise;

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">Recent Notifications</h2>
          <p className="text-sm text-muted-foreground">
            Your latest activity and important updates across the platform.
          </p>
        </div>
        <Button asChild size="sm" variant="outline">
          <Link href="/dashboard/notifications">View All</Link>
        </Button>
      </div>

      <NotificationList compact notifications={stats.notifications} />
    </section>
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

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle<Profile>();

  const statsPromise = getDashboardStats(user.id);
  const incomingRequestsPromise = getIncomingRequests(user.id);
  const myRentalsPromise = getMyRentals(user.id);
  const displayName =
    profile?.display_name || profile?.full_name || user.email || "there";

  return (
    <div className="space-y-8">
      <section className="space-y-2">
        <p className="text-sm text-muted-foreground">{format(new Date(), "PPPP")}</p>
        <h1 className="text-3xl font-semibold tracking-tight">
          Welcome back, {displayName}!
        </h1>
        <p className="text-sm text-muted-foreground">
          Here&apos;s a quick look at your marketplace activity today.
        </p>
      </section>

      <Suspense fallback={<AlertsSkeleton />}>
        <DashboardAlertsSection statsPromise={statsPromise} />
      </Suspense>

      <Suspense fallback={<SectionSkeleton cards={2} rows={2} />}>
        <ActionRequiredSection
          incomingRequestsPromise={incomingRequestsPromise}
          myRentalsPromise={myRentalsPromise}
          userId={user.id}
        />
      </Suspense>

      <Suspense fallback={<SectionSkeleton cards={4} rows={3} />}>
        <ListerSection profile={profile ?? null} statsPromise={statsPromise} userId={user.id} />
      </Suspense>

      <Suspense fallback={<SectionSkeleton cards={3} rows={3} />}>
        <RenterSection statsPromise={statsPromise} userId={user.id} />
      </Suspense>

      <QuickActionsSection />

      <Suspense fallback={<NotificationsSkeleton />}>
        <NotificationsSection statsPromise={statsPromise} />
      </Suspense>
    </div>
  );
}
