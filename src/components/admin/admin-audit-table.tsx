"use client";

import { useState } from "react";
import Link from "next/link";

import { HydratedRelativeTime } from "@/components/shared/hydrated-relative-time";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate, getInitials } from "@/lib/utils";
import type { AdminAuditLog, Profile } from "@/types";

type AuditRow = AdminAuditLog & {
  admin: Profile;
};

function formatAction(action: string) {
  return action
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getTargetHref(entry: AuditRow) {
  switch (entry.target_type) {
    case "user":
      return `/admin/users/${entry.target_id}`;
    case "listing":
      return `/admin/listings/${entry.target_id}`;
    case "booking":
      return `/admin/bookings/${entry.target_id}`;
    case "review":
      return `/admin/reviews?focus=${entry.target_id}`;
    case "category":
      return "/admin/categories";
    case "report":
      return `/admin/reports/${entry.target_id}`;
    case "settings":
      return "/admin/settings";
    case "payout":
      return "/admin/payouts";
    default:
      return "/admin/audit-log";
  }
}

export function AdminAuditTable({ entries }: { entries: AuditRow[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div className="rounded-3xl border border-orange-200/60 bg-white/90 shadow-sm">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Timestamp</TableHead>
            <TableHead>Admin</TableHead>
            <TableHead>Action</TableHead>
            <TableHead>Target Type</TableHead>
            <TableHead>Target</TableHead>
            <TableHead>Details</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.length === 0 ? (
            <TableRow>
              <TableCell className="py-8 text-center text-muted-foreground" colSpan={6}>
                No audit log entries matched these filters.
              </TableCell>
            </TableRow>
          ) : (
            entries.map((entry) => {
              const adminName =
                entry.admin.display_name || entry.admin.full_name || entry.admin.email;
              const isExpanded = expandedId === entry.id;
              return (
                <TableRow key={entry.id}>
                  <TableCell>
                    <div className="space-y-1">
                      <p>{formatDate(entry.created_at)}</p>
                      <HydratedRelativeTime
                        className="text-xs text-muted-foreground"
                        value={entry.created_at}
                      />
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar size="sm">
                        {entry.admin.avatar_url ? (
                          <AvatarImage alt={adminName} src={entry.admin.avatar_url} />
                        ) : null}
                        <AvatarFallback>{getInitials(adminName)}</AvatarFallback>
                      </Avatar>
                      <span>{adminName}</span>
                    </div>
                  </TableCell>
                  <TableCell className="font-medium text-foreground">{formatAction(entry.action)}</TableCell>
                  <TableCell>
                    <Badge className="bg-orange-100 text-orange-800 hover:bg-orange-100">
                      {entry.target_type}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Link className="text-orange-700 hover:underline" href={getTargetHref(entry)}>
                      {entry.target_id}
                    </Link>
                  </TableCell>
                  <TableCell className="max-w-[340px]">
                    <div className="space-y-2">
                      <Button
                        onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                        size="sm"
                        type="button"
                        variant="outline"
                      >
                        {isExpanded ? "Hide Details" : "View Details"}
                      </Button>
                      {isExpanded ? (
                        <pre className="overflow-x-auto rounded-2xl bg-slate-950 p-3 text-xs text-slate-100">
                          {JSON.stringify(entry.details, null, 2)}
                        </pre>
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          {Object.entries(entry.details ?? {})
                            .slice(0, 3)
                            .map(([key, value]) => `${key}: ${String(value)}`)
                            .join(" • ") || "No additional details"}
                        </p>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}
