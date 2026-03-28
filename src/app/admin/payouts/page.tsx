import { getAdminPayouts } from "@/actions/admin";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminPayoutTable } from "@/components/admin/admin-payout-table";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatCurrency } from "@/lib/utils";

type SearchParams = Record<string, string | string[] | undefined>;

function getSingleValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function getPage(value: string | undefined) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

export default async function AdminPayoutsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const resolvedSearchParams = await searchParams;
  const status = getSingleValue(resolvedSearchParams.status) as
    | "pending"
    | "processing"
    | "completed"
    | "failed"
    | undefined;
  const page = getPage(getSingleValue(resolvedSearchParams.page));
  const admin = createAdminClient();
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();

  const [payoutsResult, pendingStats, processedMonth, allPaidRows] = await Promise.all([
    getAdminPayouts({ status, page }),
    admin.from("payouts").select("amount").eq("status", "pending"),
    admin
      .from("payouts")
      .select("id", { count: "exact", head: true })
      .eq("status", "completed")
      .gte("processed_at", monthStart),
    admin.from("payouts").select("amount").eq("status", "completed"),
  ]);

  const totalPendingAmount = (pendingStats.data ?? []).reduce(
    (sum, payout) => sum + (payout.amount ?? 0),
    0,
  );
  const totalPaidOut = (allPaidRows.data ?? []).reduce(
    (sum, payout) => sum + (payout.amount ?? 0),
    0,
  );

  const stats = [
    {
      label: "Total Pending",
      value: `${payoutsResult.data.filter((payout) => payout.status === "pending").length} · ${formatCurrency(totalPendingAmount)}`,
    },
    {
      label: "Processed This Month",
      value: (processedMonth.count ?? 0).toLocaleString(),
    },
    {
      label: "Total Paid Out All Time",
      value: formatCurrency(totalPaidOut),
    },
  ];

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Payouts"
        description="Process lister payouts, track settlement status, and export pending payment queues."
      />

      <div className="grid gap-4 md:grid-cols-3">
        {stats.map((stat) => (
          <Card key={stat.label} className="border-orange-200/60 bg-white/90 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold tracking-tight text-foreground">{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <AdminPayoutTable
        currentPage={payoutsResult.currentPage}
        payouts={payoutsResult.data}
        totalPages={payoutsResult.totalPages}
        totalPendingAmount={totalPendingAmount}
      />
    </div>
  );
}
