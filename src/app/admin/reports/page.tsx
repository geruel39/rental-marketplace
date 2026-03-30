import { getAdminReports } from "@/actions/admin";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminReportTable } from "@/components/admin/admin-report-table";
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

export default async function AdminReportsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const resolvedSearchParams = await searchParams;
  const status =
    (getSingleValue(resolvedSearchParams.status) as
      | "open"
      | "investigating"
      | "resolved"
      | "dismissed"
      | undefined) ?? "open";
  const page = getPage(getSingleValue(resolvedSearchParams.page));
  const admin = createAdminClient();
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();

  const [reportsResult, openCount, investigatingCount, resolvedThisMonth] = await Promise.all([
    getAdminReports({ status, page }),
    admin.from("reports").select("id", { count: "exact", head: true }).eq("status", "open"),
    admin
      .from("reports")
      .select("id", { count: "exact", head: true })
      .eq("status", "investigating"),
    admin
      .from("reports")
      .select("id", { count: "exact", head: true })
      .eq("status", "resolved")
      .gte("resolved_at", monthStart),
  ]);

  const stats = [
    { label: "Open", value: openCount.count ?? 0, tone: "text-red-700" },
    { label: "Investigating", value: investigatingCount.count ?? 0, tone: "text-amber-700" },
    { label: "Resolved This Month", value: resolvedThisMonth.count ?? 0, tone: "text-emerald-700" },
  ];

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Reports"
        description="Triage trust and safety reports, investigate incidents, and route enforcement actions quickly."
      />

      <div className="grid gap-4 md:grid-cols-3">
        {stats.map((stat) => (
          <Card key={stat.label} className="border-orange-200/60 bg-white/90 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{stat.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className={`text-3xl font-semibold tracking-tight ${stat.tone}`}>
                {stat.value.toLocaleString()}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <AdminReportTable
        currentPage={reportsResult.currentPage}
        reports={reportsResult.data}
        totalPages={reportsResult.totalPages}
      />
    </div>
  );
}
