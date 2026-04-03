import { getAdminUsers } from "@/actions/admin";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminUserTable } from "@/components/admin/admin-user-table";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type SearchParams = Record<string, string | string[] | undefined>;

function getSingleValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function getPage(value: string | undefined) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const resolvedSearchParams = await searchParams;
  const search = getSingleValue(resolvedSearchParams.search);
  const status = getSingleValue(resolvedSearchParams.status) as
    | "active"
    | "suspended"
    | "all"
    | undefined;
  const accountType = getSingleValue(resolvedSearchParams.accountType) as
    | "individual"
    | "business"
    | "all"
    | undefined;
  const page = getPage(getSingleValue(resolvedSearchParams.page));

  const [usersResult, allUsers, activeUsers, suspendedUsers, businessUsers] =
    await Promise.all([
      getAdminUsers({
        search,
        status,
        accountType,
        page,
      }),
      getAdminUsers({ perPage: 1 }),
      getAdminUsers({ status: "active", perPage: 1 }),
      getAdminUsers({ status: "suspended", perPage: 1 }),
      getAdminUsers({ accountType: "business", perPage: 1 }),
    ]);

  const statCards = [
    { label: "Total users", value: allUsers.totalCount },
    { label: "Active", value: activeUsers.totalCount },
    { label: "Suspended", value: suspendedUsers.totalCount },
    { label: "Business accounts", value: businessUsers.totalCount },
  ];

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Users"
        description="Review accounts, moderate access, and grant administrative permissions where needed."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {statCards.map((stat) => (
          <Card key={stat.label} className="border-border/70 bg-white shadow-sm">
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

      <AdminUserTable
        currentPage={usersResult.currentPage}
        totalCount={usersResult.totalCount}
        totalPages={usersResult.totalPages}
        users={usersResult.data}
      />
    </div>
  );
}

