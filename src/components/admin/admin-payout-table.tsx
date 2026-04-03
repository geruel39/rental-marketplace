"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Download, MoreHorizontal } from "lucide-react";

import { PayoutProcessDialog } from "@/components/admin/payout-process-dialog";
import { Pagination } from "@/components/shared/pagination";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency, formatDate, getInitials } from "@/lib/utils";
import type { Booking, Payout, Profile } from "@/types";

type PayoutRow = Payout & {
  lister: Profile;
  booking: Booking | null;
};

const statusTone: Record<string, string> = {
  pending: "bg-amber-500 text-black hover:bg-amber-500",
  processing: "bg-sky-600 text-white hover:bg-sky-600",
  completed: "bg-emerald-600 text-white hover:bg-emerald-600",
  failed: "bg-red-600 text-white hover:bg-red-600",
};

export function AdminPayoutTable({
  payouts,
  totalPendingAmount,
  currentPage,
  totalPages,
}: {
  payouts: PayoutRow[];
  totalPendingAmount: number;
  currentPage: number;
  totalPages: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeTab = searchParams.get("status") ?? "all";

  function updateStatus(status: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (status === "all") {
      params.delete("status");
    } else {
      params.set("status", status);
    }
    params.delete("page");
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  function exportPendingCsv() {
    const pending = payouts.filter((payout) => payout.status === "pending");
    const rows = [
      ["date", "lister", "booking_ref", "amount", "currency"].join(","),
      ...pending.map((payout) =>
        [
          payout.created_at,
          `"${payout.lister.display_name || payout.lister.full_name || payout.lister.email}"`,
          payout.booking_id ?? "",
          payout.amount,
          payout.currency,
        ].join(","),
      ),
    ];
    const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "pending-payouts.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2 rounded-2xl border border-border/70 bg-white p-2">
          {["all", "pending", "completed", "failed"].map((tab) => (
            <Button
              key={tab}
              onClick={() => updateStatus(tab)}
              size="sm"
              type="button"
              variant={activeTab === tab ? "default" : "ghost"}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </Button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <div className="rounded-2xl border border-border bg-brand-light px-4 py-2 text-sm">
            Pending total: <span className="font-semibold">{formatCurrency(totalPendingAmount)}</span>
          </div>
          <Button onClick={exportPendingCsv} type="button" variant="outline">
            <Download className="size-4" />
            Export Pending CSV
          </Button>
        </div>
      </div>

      <div className="rounded-3xl border border-border/70 bg-white shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Lister</TableHead>
              <TableHead>Booking Ref</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Currency</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Method</TableHead>
              <TableHead>Reference #</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {payouts.length === 0 ? (
              <TableRow>
                <TableCell className="py-8 text-center text-muted-foreground" colSpan={9}>
                  No payouts matched this filter.
                </TableCell>
              </TableRow>
            ) : (
              payouts.map((payout) => {
                const listerName =
                  payout.lister.display_name || payout.lister.full_name || payout.lister.email;

                return (
                  <TableRow key={payout.id}>
                    <TableCell>{formatDate(payout.created_at)}</TableCell>
                    <TableCell>
                      <Link
                        className="flex items-center gap-3 hover:underline"
                        href={`/admin/users/${payout.lister.id}`}
                      >
                        <Avatar size="sm">
                          {payout.lister.avatar_url ? (
                            <AvatarImage alt={listerName} src={payout.lister.avatar_url} />
                          ) : null}
                          <AvatarFallback>{getInitials(listerName)}</AvatarFallback>
                        </Avatar>
                        <span className="whitespace-normal">{listerName}</span>
                      </Link>
                    </TableCell>
                    <TableCell>
                      {payout.booking_id ? (
                        <Link href={`/admin/bookings/${payout.booking_id}`}>{payout.booking_id.slice(0, 8)}</Link>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                    <TableCell className="font-semibold text-foreground">
                      {formatCurrency(payout.amount, payout.currency)}
                    </TableCell>
                    <TableCell>{payout.currency}</TableCell>
                    <TableCell>
                      <Badge
                        className={statusTone[payout.status] ?? "bg-muted text-foreground hover:bg-muted"}
                      >
                        {payout.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{payout.payout_method ?? "-"}</TableCell>
                    <TableCell>{payout.reference_number ?? "-"}</TableCell>
                    <TableCell className="text-right">
                      {payout.status === "pending" ? (
                        <PayoutProcessDialog
                          onComplete={() => router.refresh()}
                          payout={payout}
                          trigger={
                            <Button className="bg-brand-navy text-white hover:bg-brand-steel" size="sm">
                              Process
                            </Button>
                          }
                        />
                      ) : (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="icon-sm" variant="ghost">
                              <MoreHorizontal className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem asChild>
                              <Link href={`/admin/bookings/${payout.booking_id}`}>View Booking</Link>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
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

