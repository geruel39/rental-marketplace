import { getAdminBookings } from "@/actions/admin";
import { AdminBookingTable } from "@/components/admin/admin-booking-table";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";

type SearchParams = Record<string, string | string[] | undefined>;

function getSingleValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function getPage(value: string | undefined) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

export default async function AdminBookingsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const resolvedSearchParams = await searchParams;
  const filter = getSingleValue(resolvedSearchParams.filter);
  const page = getPage(getSingleValue(resolvedSearchParams.page));

  const status =
    filter === "active" || filter === "completed" ? filter : undefined;
  const disputed = filter === "disputed" ? true : undefined;

  const [bookingsResult, totalResult, activeResult, disputedResult, completedResult] =
    await Promise.all([
      getAdminBookings({ status, disputed, page }),
      getAdminBookings({ perPage: 1 }),
      getAdminBookings({ status: "active", perPage: 1 }),
      getAdminBookings({ disputed: true, perPage: 1 }),
      getAdminBookings({ status: "completed", perPage: 1 }),
    ]);

  const stats = [
    { label: "Total", value: totalResult.totalCount },
    { label: "Active", value: activeResult.totalCount },
    { label: "Disputed", value: disputedResult.totalCount },
    { label: "Completed", value: completedResult.totalCount },
  ];

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Bookings"
        description="Oversee booking operations, intervene in disputes, and review payment and fulfillment status across the platform."
      />

      {disputedResult.totalCount > 0 ? (
        <Alert className="border-red-200 bg-red-50 text-red-950">
          <AlertTriangle className="text-red-700" />
          <AlertTitle>Disputes need attention</AlertTitle>
          <AlertDescription>
            {disputedResult.totalCount} booking dispute(s) are waiting for an admin resolution.
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label} className="border-orange-200/60 bg-white/90 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold tracking-tight text-foreground">
                {stat.value.toLocaleString()}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <AdminBookingTable
        bookings={bookingsResult.data}
        currentPage={bookingsResult.currentPage}
        totalPages={bookingsResult.totalPages}
      />
    </div>
  );
}
