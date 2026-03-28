import { getAdminListings } from "@/actions/admin";
import { AdminListingTable } from "@/components/admin/admin-listing-table";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createAdminClient } from "@/lib/supabase/admin";

type SearchParams = Record<string, string | string[] | undefined>;

function getSingleValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function getPage(value: string | undefined) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function mapFilter(filter: string | undefined) {
  switch (filter) {
    case "pending":
      return { moderationStatus: "pending" as const };
    case "flagged":
      return { flagged: true };
    case "rejected":
      return { moderationStatus: "rejected" as const };
    case "active":
      return { status: "active" as const };
    default:
      return {};
  }
}

export default async function AdminListingsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const resolvedSearchParams = await searchParams;
  const filter = getSingleValue(resolvedSearchParams.filter);
  const search = getSingleValue(resolvedSearchParams.search);
  const page = getPage(getSingleValue(resolvedSearchParams.page));
  const admin = createAdminClient();

  const [listingsResult, totalResult, activeResult, pendingResult, flaggedResult, categories] =
    await Promise.all([
      getAdminListings({
        search,
        page,
        ...mapFilter(filter),
      }),
      getAdminListings({ perPage: 1 }),
      getAdminListings({ status: "active", perPage: 1 }),
      getAdminListings({ moderationStatus: "pending", perPage: 1 }),
      getAdminListings({ flagged: true, perPage: 1 }),
      admin.from("categories").select("id, name"),
    ]);

  const categoryMap = Object.fromEntries(
    (categories.data ?? []).map((category) => [category.id, category.name]),
  );

  const stats = [
    { label: "Total", value: totalResult.totalCount },
    { label: "Active", value: activeResult.totalCount },
    { label: "Pending Review", value: pendingResult.totalCount },
    { label: "Flagged", value: flaggedResult.totalCount },
  ];

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Listings"
        description="Review marketplace supply, moderate risky inventory, and move listings through approval workflows."
      />

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

      <AdminListingTable
        categories={categoryMap}
        currentPage={listingsResult.currentPage}
        listings={listingsResult.data}
        totalCount={listingsResult.totalCount}
        totalPages={listingsResult.totalPages}
      />
    </div>
  );
}
