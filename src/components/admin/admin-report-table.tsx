"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { resolveReport, updateReportStatus } from "@/actions/admin";
import { Pagination } from "@/components/shared/pagination";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate, getInitials } from "@/lib/utils";
import type { ReportWithDetails } from "@/types";

const typeTone: Record<string, string> = {
  fraud: "bg-red-600 text-white hover:bg-red-600",
  harassment: "bg-brand-sky text-brand-dark hover:bg-brand-sky",
  safety: "bg-amber-500 text-black hover:bg-amber-500",
  spam: "bg-sky-600 text-white hover:bg-sky-600",
};

const statusTone: Record<string, string> = {
  open: "bg-red-600 text-white hover:bg-red-600",
  investigating: "bg-amber-500 text-black hover:bg-amber-500",
  resolved: "bg-emerald-600 text-white hover:bg-emerald-600",
  dismissed: "bg-muted text-foreground hover:bg-muted",
};

export function AdminReportTable({
  reports,
  currentPage,
  totalPages,
}: {
  reports: ReportWithDetails[];
  currentPage: number;
  totalPages: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeFilter = searchParams.get("status") ?? "open";

  function updateStatusFilter(status: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("status", status);
    params.delete("page");
    router.push(`${pathname}?${params.toString()}`);
  }

  async function handleAction(task: () => Promise<void>) {
    await task();
    router.refresh();
  }

  function getReportedLabel(report: ReportWithDetails) {
    if (report.reported_user) {
      return report.reported_user.display_name || report.reported_user.full_name || report.reported_user.email;
    }
    if (report.reported_listing) {
      return report.reported_listing.title;
    }
    if (report.reported_review) {
      return report.reported_review.comment?.slice(0, 40) || "Review";
    }
    return "Unknown target";
  }

  function getReportedHref(report: ReportWithDetails) {
    if (report.reported_user) return `/admin/users/${report.reported_user.id}`;
    if (report.reported_listing) return `/admin/listings/${report.reported_listing.id}`;
    if (report.reported_review) return `/admin/reports/${report.id}`;
    return `/admin/reports/${report.id}`;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 rounded-2xl border border-border/70 bg-white p-2">
        {["open", "investigating", "resolved", "dismissed"].map((status) => (
          <Button
            key={status}
            onClick={() => updateStatusFilter(status)}
            size="sm"
            type="button"
            variant={activeFilter === status ? "default" : "ghost"}
          >
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </Button>
        ))}
      </div>

      <div className="rounded-3xl border border-border/70 bg-white shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Reporter</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Reported</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {reports.length === 0 ? (
              <TableRow>
                <TableCell className="py-8 text-center text-muted-foreground" colSpan={7}>
                  No reports matched this filter.
                </TableCell>
              </TableRow>
            ) : (
              reports.map((report) => {
                const reporterName =
                  report.reporter.display_name ||
                  report.reporter.full_name ||
                  report.reporter.email;

                return (
                  <TableRow key={report.id}>
                    <TableCell>{formatDate(report.created_at)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar size="sm">
                          {report.reporter.avatar_url ? (
                            <AvatarImage alt={reporterName} src={report.reporter.avatar_url} />
                          ) : null}
                          <AvatarFallback>{getInitials(reporterName)}</AvatarFallback>
                        </Avatar>
                        <span>{reporterName}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={typeTone[report.report_type] ?? "bg-slate-600 text-white hover:bg-slate-600"}>
                        {report.report_type}
                      </Badge>
                    </TableCell>
                    <TableCell className="whitespace-normal">
                      <Link className="text-brand-sky hover:text-brand-navy hover:underline" href={getReportedHref(report)}>
                        {getReportedLabel(report)}
                      </Link>
                    </TableCell>
                    <TableCell className="max-w-[320px] whitespace-normal text-muted-foreground">
                      {report.description.slice(0, 120)}
                    </TableCell>
                    <TableCell>
                      <Badge className={statusTone[report.status] ?? "bg-muted text-foreground hover:bg-muted"}>
                        {report.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {report.status === "open" ? (
                          <Button
                            onClick={() =>
                              void handleAction(async () => {
                                await updateReportStatus(
                                  report.id,
                                  "investigating",
                                  report.admin_notes ?? undefined,
                                );
                              })
                            }
                            size="sm"
                            variant="outline"
                          >
                            Investigate
                          </Button>
                        ) : null}
                        {report.status !== "resolved" ? (
                          <Button
                            className="bg-emerald-600 text-white hover:bg-emerald-700"
                            onClick={() =>
                              void handleAction(async () => {
                                await resolveReport(report.id, "resolved", report.admin_notes || "Resolved by admin");
                              })
                            }
                            size="sm"
                          >
                            Resolve
                          </Button>
                        ) : null}
                        {report.status !== "dismissed" ? (
                          <Button
                            onClick={() =>
                              void handleAction(async () => {
                                await resolveReport(report.id, "dismissed", report.admin_notes || "Dismissed by admin");
                              })
                            }
                            size="sm"
                            variant="outline"
                          >
                            Dismiss
                          </Button>
                        ) : null}
                        <Button asChild size="sm" variant="ghost">
                          <Link href={`/admin/reports/${report.id}`}>View Details</Link>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex justify-end">
        <Pagination currentPage={currentPage} totalPages={totalPages} />
      </div>
    </div>
  );
}

