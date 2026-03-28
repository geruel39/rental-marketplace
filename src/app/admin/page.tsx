import Link from "next/link";
import { ArrowRight, ShieldAlert } from "lucide-react";

import {
  getAdminDashboardStats,
  getAuditLog,
  getPlatformSettings,
} from "@/actions/admin";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminStatsCards } from "@/components/admin/admin-stats-cards";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatRelativeTime } from "@/lib/utils";

function toBoolean(value: unknown) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    return ["true", "1", "on", "yes"].includes(value.toLowerCase());
  }
  if (typeof value === "number") return value === 1;
  return false;
}

function formatActionLabel(action: string) {
  return action
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export default async function AdminPage() {
  const [stats, settings, auditLog] = await Promise.all([
    getAdminDashboardStats(),
    getPlatformSettings(),
    getAuditLog({ perPage: 5 }),
  ]);

  const maintenanceMode = toBoolean(settings.maintenance_mode);
  const actionItems = [
    {
      label: "Pending payouts needing processing",
      count: stats.pendingPayouts,
      href: "/admin/payouts?status=pending",
    },
    {
      label: "Open reports needing review",
      count: stats.openReports,
      href: "/admin/reports",
    },
    {
      label: "Flagged listings needing moderation",
      count: stats.flaggedListings,
      href: "/admin/listings?flagged=true",
    },
    {
      label: "Disputed bookings needing resolution",
      count: stats.disputedBookings,
      href: "/admin/bookings?disputed=true",
    },
  ];

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Admin Dashboard"
        description="Monitor marketplace health, review urgent operational items, and keep the platform running smoothly."
      />

      {maintenanceMode ? (
        <Alert className="border-orange-300 bg-orange-50 text-orange-950">
          <ShieldAlert className="text-orange-700" />
          <AlertTitle>Maintenance mode is enabled</AlertTitle>
          <AlertDescription>
            The platform is currently in maintenance mode. Review platform settings before
            reopening access to users.
          </AlertDescription>
        </Alert>
      ) : null}

      <AdminStatsCards stats={stats} />

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className="border-orange-200/60 bg-white/90 shadow-sm">
          <CardHeader>
            <CardTitle>Action Required</CardTitle>
            <CardDescription>Priority queues that need an admin decision soon.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {actionItems.map((item) => (
              <div
                key={item.label}
                className="flex items-center justify-between gap-4 rounded-2xl border border-orange-100 bg-orange-50/40 p-4"
              >
                <div className="space-y-2">
                  <p className="text-sm font-medium text-foreground">{item.label}</p>
                  <Badge className="bg-orange-600 text-white hover:bg-orange-600">
                    {item.count.toLocaleString()}
                  </Badge>
                </div>
                <Link
                  className="inline-flex items-center gap-1 text-sm font-medium text-orange-700 transition-colors hover:text-orange-900"
                  href={item.href}
                >
                  View
                  <ArrowRight className="size-4" />
                </Link>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-orange-200/60 bg-white/90 shadow-sm">
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>The latest admin audit log events across the platform.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {auditLog.data.length === 0 ? (
              <p className="text-sm text-muted-foreground">No recent admin activity yet.</p>
            ) : (
              auditLog.data.map((entry) => {
                const adminName =
                  entry.admin.display_name ||
                  entry.admin.full_name ||
                  entry.admin.email;

                return (
                  <div
                    key={entry.id}
                    className="rounded-2xl border border-orange-100 bg-orange-50/30 p-4"
                  >
                    <p className="text-sm font-medium text-foreground">
                      {adminName} performed {formatActionLabel(entry.action)}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {entry.target_type} #{entry.target_id}
                    </p>
                    <p className="mt-2 text-xs font-medium uppercase tracking-[0.16em] text-orange-700">
                      {formatRelativeTime(entry.created_at)}
                    </p>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
