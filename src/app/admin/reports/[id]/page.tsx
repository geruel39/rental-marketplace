import Link from "next/link";
import { notFound } from "next/navigation";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { ReportDetailActions } from "@/components/admin/report-detail-actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";
import type { Report, ReportWithDetails } from "@/types";

async function verifyAdminAccess() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("Unauthorized");
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle<{ is_admin: boolean }>();
  if (!profile?.is_admin) throw new Error("Unauthorized");
}

export default async function AdminReportDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await verifyAdminAccess();
  const { id } = await params;
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("reports")
    .select(
      `
        *,
        reporter:profiles!reports_reporter_id_fkey(*),
        reported_user:profiles!reports_reported_user_id_fkey(*),
        reported_listing:listings!reports_reported_listing_id_fkey(*),
        reported_review:reviews!reports_reported_review_id_fkey(*)
      `,
    )
    .eq("id", id)
    .maybeSingle();

  if (error || !data) notFound();

  const report = data as ReportWithDetails;
  const relatedReportFilters = [
    report.reported_user_id ? `reported_user_id.eq.${report.reported_user_id}` : null,
    report.reported_listing_id ? `reported_listing_id.eq.${report.reported_listing_id}` : null,
    report.reported_review_id ? `reported_review_id.eq.${report.reported_review_id}` : null,
  ].filter(Boolean) as string[];

  const relatedReports =
    relatedReportFilters.length === 0
      ? []
      : (((await admin
          .from("reports")
          .select("*")
          .or(relatedReportFilters.join(","))
          .neq("id", report.id)
          .limit(5)).data ?? []) as Report[]);

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Report Detail"
        description="Review the full report context, inspect related incidents, and apply the right administrative action."
      />

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <Card className="border-border/70 bg-white shadow-sm">
          <CardHeader>
            <CardTitle>Reporter</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p className="font-medium text-foreground">
              {report.reporter.display_name || report.reporter.full_name || report.reporter.email}
            </p>
            <p className="text-muted-foreground">{report.reporter.email}</p>
            <Button asChild variant="outline">
              <Link href={`/admin/users/${report.reporter.id}`}>Open Admin User Profile</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-white shadow-sm">
          <CardHeader>
            <CardTitle>Report Summary</CardTitle>
            <CardDescription>
              {report.report_type} · submitted {formatDate(report.created_at)}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="whitespace-pre-wrap text-sm text-muted-foreground">
              {report.description}
            </p>
            <ReportDetailActions
              initialNotes={report.admin_notes}
              initialStatus={report.status}
              reportId={report.id}
            />
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/70 bg-white shadow-sm">
        <CardHeader>
          <CardTitle>Reported Entity</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          {report.reported_user ? (
            <>
              <p className="font-medium text-foreground">
                User: {report.reported_user.display_name || report.reported_user.full_name || report.reported_user.email}
              </p>
              <Button asChild variant="outline">
                <Link href={`/admin/users/${report.reported_user.id}`}>Go to User Moderation</Link>
              </Button>
            </>
          ) : null}
          {report.reported_listing ? (
            <>
              <p className="font-medium text-foreground">Listing: {report.reported_listing.title}</p>
              <Button asChild variant="outline">
                <Link href={`/admin/listings/${report.reported_listing.id}`}>Go to Listing Moderation</Link>
              </Button>
            </>
          ) : null}
          {report.reported_review ? (
            <>
              <p className="font-medium text-foreground">Review</p>
              <p className="text-muted-foreground">{report.reported_review.comment || "No comment"}</p>
              <Button asChild variant="outline">
                <Link href={`/admin/reviews?focus=${report.reported_review.id}`}>Go to Review Moderation</Link>
              </Button>
            </>
          ) : null}
        </CardContent>
      </Card>

      <Card className="border-border/70 bg-white shadow-sm">
        <CardHeader>
          <CardTitle>Related Reports</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {relatedReports.length === 0 ? (
            <p className="text-sm text-muted-foreground">No related reports found.</p>
          ) : (
            relatedReports.map((item) => (
              <Link
                key={item.id}
                className="block rounded-2xl border border-brand-navy/10 bg-brand-light p-4 transition-colors hover:bg-brand-light"
                href={`/admin/reports/${item.id}`}
              >
                <p className="font-medium text-foreground">{item.report_type}</p>
                <p className="mt-1 text-sm text-muted-foreground">{item.description.slice(0, 140)}</p>
              </Link>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

