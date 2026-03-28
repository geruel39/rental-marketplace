import { TrendingUp } from "lucide-react";

import { getAdminDashboardStats } from "@/actions/admin";
import { AdminChart } from "@/components/admin/admin-chart";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency } from "@/lib/utils";
import type { Booking, Listing, Profile } from "@/types";

type RevenueChartPoint = {
  month: string;
  revenue: number;
};

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function subMonths(date: Date, months: number) {
  return new Date(date.getFullYear(), date.getMonth() - months, 1);
}

function percentChange(current: number, previous: number) {
  if (previous === 0) {
    return current === 0 ? 0 : 100;
  }

  return ((current - previous) / previous) * 100;
}

function average(values: number[]) {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

async function verifyAdminAccess() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Unauthorized");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle<{ is_admin: boolean }>();

  if (!profile?.is_admin) {
    throw new Error("Unauthorized");
  }
}

export default async function AdminAnalyticsPage() {
  await verifyAdminAccess();

  const admin = createAdminClient();
  const now = new Date();
  const monthStart = startOfMonth(now);
  const lastMonthStart = subMonths(now, 1);
  const activeUserThreshold = new Date(now);
  activeUserThreshold.setDate(activeUserThreshold.getDate() - 30);

  const [stats, activeUsersResult, listingsResult, bookingsResult, categoriesResult] =
    await Promise.all([
      getAdminDashboardStats(),
      admin
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .gte("last_active", activeUserThreshold.toISOString()),
      admin.from("listings").select("*"),
      admin.from("bookings").select("*"),
      admin.from("categories").select("id, name"),
    ]);

  const listings = (listingsResult.data ?? []) as Listing[];
  const bookings = (bookingsResult.data ?? []) as Booking[];
  const categories = (categoriesResult.data ?? []) as Array<{ id: string; name: string }>;

  const lastMonthRevenue = bookings
    .filter(
      (booking) =>
        booking.status === "completed" &&
        new Date(booking.updated_at) >= lastMonthStart &&
        new Date(booking.updated_at) < monthStart,
    )
    .reduce(
      (sum, booking) => sum + booking.service_fee_renter + booking.service_fee_lister,
      0,
    );

  const growthPercentage = percentChange(stats.revenueThisMonth, lastMonthRevenue);
  const averagePricePerDay = average(
    listings
      .map((listing) => listing.price_per_day)
      .filter((value): value is number => typeof value === "number"),
  );
  const completedBookings = bookings.filter((booking) => booking.status === "completed");
  const completionRate = bookings.length === 0 ? 0 : (completedBookings.length / bookings.length) * 100;
  const averageBookingValue = average(
    bookings
      .map((booking) => booking.total_price)
      .filter((value): value is number => typeof value === "number"),
  );
  const totalReservedItems = listings.reduce(
    (sum, listing) => sum + listing.quantity_reserved,
    0,
  );
  const utilizationRate =
    stats.totalInventoryItems === 0
      ? 0
      : (totalReservedItems / stats.totalInventoryItems) * 100;

  const revenueChartData: RevenueChartPoint[] = Array.from({ length: 12 }, (_, index) => {
    const periodStart = subMonths(now, 11 - index);
    const periodEnd = subMonths(now, 10 - index);
    const label = periodStart.toLocaleString("en-US", { month: "short" });
    const revenue = bookings
      .filter(
        (booking) =>
          booking.status === "completed" &&
          new Date(booking.updated_at) >= periodStart &&
          new Date(booking.updated_at) < periodEnd,
      )
      .reduce(
        (sum, booking) => sum + booking.service_fee_renter + booking.service_fee_lister,
        0,
      );

    return {
      month: label,
      revenue,
    };
  });

  const topCategories = categories
    .map((category) => ({
      id: category.id,
      name: category.name,
      listingCount: listings.filter((listing) => listing.category_id === category.id).length,
    }))
    .sort((a, b) => b.listingCount - a.listingCount)
    .slice(0, 5);

  const listerRevenueMap = new Map<string, number>();
  completedBookings.forEach((booking) => {
    listerRevenueMap.set(
      booking.lister_id,
      (listerRevenueMap.get(booking.lister_id) ?? 0) + booking.lister_payout,
    );
  });

  const listerIds = Array.from(listerRevenueMap.keys());
  const { data: listerProfiles } =
    listerIds.length > 0
      ? await admin
          .from("profiles")
          .select("*")
          .in("id", listerIds)
      : { data: [] as Profile[] };

  const listerMap = new Map(
    ((listerProfiles ?? []) as Profile[]).map((profile) => [profile.id, profile]),
  );

  const topListers = Array.from(listerRevenueMap.entries())
    .map(([listerId, revenue]) => ({
      listerId,
      revenue,
      profile: listerMap.get(listerId),
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

  const metricCards = [
    {
      title: "Revenue",
      items: [
        `Total: ${formatCurrency(stats.totalRevenue)}`,
        `This month: ${formatCurrency(stats.revenueThisMonth)}`,
        `Last month: ${formatCurrency(lastMonthRevenue)}`,
        `Growth: ${growthPercentage.toFixed(1)}%`,
      ],
    },
    {
      title: "Users",
      items: [
        `Total: ${stats.totalUsers.toLocaleString()}`,
        `New this month: ${stats.newUsersThisMonth.toLocaleString()}`,
        `Active last 30 days: ${(activeUsersResult.count ?? 0).toLocaleString()}`,
      ],
    },
    {
      title: "Listings",
      items: [
        `Total: ${stats.totalListings.toLocaleString()}`,
        `Active: ${stats.activeListings.toLocaleString()}`,
        `Average price per day: ${formatCurrency(averagePricePerDay)}`,
      ],
    },
    {
      title: "Bookings",
      items: [
        `Total: ${stats.totalBookings.toLocaleString()}`,
        `Completion rate: ${completionRate.toFixed(1)}%`,
        `Average booking value: ${formatCurrency(averageBookingValue)}`,
      ],
    },
    {
      title: "Inventory",
      items: [
        `Total items: ${stats.totalInventoryItems.toLocaleString()}`,
        `Utilization rate: ${utilizationRate.toFixed(1)}%`,
      ],
    },
  ];

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Analytics"
        description="Track growth, revenue performance, inventory efficiency, and the marketplace operators driving the most value."
        action={
          <Button asChild className="bg-orange-600 text-white hover:bg-orange-700">
            <a href="/admin/reports">Review reports</a>
          </Button>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {metricCards.map((card) => (
          <Card key={card.title} className="border-orange-200/60 bg-white/90 shadow-sm">
            <CardHeader>
              <CardTitle>{card.title}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {card.items.map((item) => (
                <p key={item} className="text-sm text-foreground">
                  {item}
                </p>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-orange-200/60 bg-white/90 shadow-sm">
        <CardHeader>
          <div className="flex items-center gap-2">
            <TrendingUp className="size-5 text-orange-600" />
            <CardTitle>Revenue Trend</CardTitle>
          </div>
          <CardDescription>Platform fee revenue across the last 12 months.</CardDescription>
        </CardHeader>
        <CardContent>
          <AdminChart data={revenueChartData} />
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="border-orange-200/60 bg-white/90 shadow-sm">
          <CardHeader>
            <CardTitle>Top Categories</CardTitle>
            <CardDescription>Categories with the highest active supply of listings.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {topCategories.map((category, index) => (
              <div
                key={category.id}
                className="flex items-center justify-between rounded-2xl border border-orange-100 bg-orange-50/30 p-4"
              >
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {index + 1}. {category.name}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {category.listingCount.toLocaleString()} listings
                  </p>
                </div>
                <Badge className="bg-orange-600 text-white hover:bg-orange-600">
                  {category.listingCount}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-orange-200/60 bg-white/90 shadow-sm">
          <CardHeader>
            <CardTitle>Top Listers</CardTitle>
            <CardDescription>Listers ranked by completed booking payout volume.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {topListers.map((entry, index) => {
              const name =
                entry.profile?.display_name ||
                entry.profile?.full_name ||
                entry.profile?.email ||
                "Unknown lister";

              return (
                <div
                  key={entry.listerId}
                  className="flex items-center justify-between rounded-2xl border border-orange-100 bg-orange-50/30 p-4"
                >
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {index + 1}. {name}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {formatCurrency(entry.revenue)} in lister payouts
                    </p>
                  </div>
                  <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">
                    {formatCurrency(entry.revenue)}
                  </Badge>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
