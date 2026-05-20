import Link from "next/link";
import { AlertTriangle } from "lucide-react";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { RefundActions } from "@/components/admin/refund-actions";
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
import { createAdminClient } from "@/lib/supabase/admin";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import type { Booking, Listing, Profile, Refund, Transaction } from "@/types";

type SearchParams = Record<string, string | string[] | undefined>;
type RefundStatus = Refund["status"] | "all";

type AdminRefundRowRaw = Refund & {
  renter: Profile | Profile[] | null;
  transaction:
    | Pick<Transaction, "external_reference" | "external_notes">
    | Array<Pick<Transaction, "external_reference" | "external_notes">>
    | null;
  booking:
    | (Booking & {
        listing: Pick<Listing, "id" | "title"> | Array<Pick<Listing, "id" | "title">> | null;
        lister: Profile | Profile[] | null;
      })
    | Array<
        Booking & {
          listing: Pick<Listing, "id" | "title"> | Array<Pick<Listing, "id" | "title">> | null;
          lister: Profile | Profile[] | null;
        }
      >
    | null;
};

type AdminRefundRow = Refund & {
  renter: Profile;
  transaction: Pick<Transaction, "external_reference" | "external_notes"> | null;
  booking: Booking & {
    listing: Pick<Listing, "id" | "title"> | null;
    lister: Profile | null;
  };
};

const statusTone: Record<Refund["status"], string> = {
  pending: "bg-amber-100 text-amber-900 hover:bg-amber-100",
  processing: "bg-sky-100 text-sky-900 hover:bg-sky-100",
  completed: "bg-emerald-100 text-emerald-900 hover:bg-emerald-100",
  failed: "bg-rose-100 text-rose-900 hover:bg-rose-100",
};

function unwrapRelation<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

function getSingleValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function getStatus(value?: string): RefundStatus {
  return value === "pending" ||
    value === "processing" ||
    value === "completed" ||
    value === "failed"
    ? value
    : "all";
}

export default async function AdminRefundsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const resolvedSearchParams = await searchParams;
  const activeStatus = getStatus(getSingleValue(resolvedSearchParams.status));
  const admin = createAdminClient();

  let query = admin
    .from("refunds")
    .select(
      `
        *,
        transaction:transactions!refunds_transaction_id_fkey(external_reference, external_notes),
        renter:profiles!refunds_renter_id_fkey(*),
        booking:bookings!refunds_booking_id_fkey(
          *,
          listing:listings!bookings_listing_id_fkey(id, title),
          lister:profiles!bookings_lister_id_fkey(*)
        )
      `,
    )
    .order("created_at", { ascending: false });

  if (activeStatus !== "all") {
    query = query.eq("status", activeStatus);
  }

  const { data, error } = await query;

  if (error) {
    return (
      <div className="space-y-6">
        <AdminPageHeader
          title="Refunds"
          description="Review automatic refund status and complete manual follow-up."
        />
        <div className="rounded-3xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-800">
          Could not load refunds: {error.message}
        </div>
      </div>
    );
  }

  const refunds = ((data ?? []) as AdminRefundRowRaw[])
    .map((refund) => {
      const renter = unwrapRelation(refund.renter);
      const transaction = unwrapRelation(refund.transaction);
      const booking = unwrapRelation(refund.booking);
      const listing = unwrapRelation(booking?.listing);
      const lister = unwrapRelation(booking?.lister);

      if (!renter || !booking) {
        return null;
      }

      return {
        ...refund,
        transaction,
        renter,
        booking: {
          ...booking,
          listing,
          lister,
        },
      } satisfies AdminRefundRow;
    })
    .filter((refund): refund is AdminRefundRow => refund !== null);

  const actionableRefunds = refunds.filter(
    (refund) => refund.status === "failed" || refund.status === "processing",
  );
  const pendingRefunds = refunds.filter((refund) => refund.status === "pending");
  const completedRefunds = refunds.filter((refund) => refund.status === "completed");
  const totalRefunded = completedRefunds.reduce(
    (sum, refund) => sum + refund.refund_amount,
    0,
  );
  const actionAmount = actionableRefunds.reduce(
    (sum, refund) => sum + refund.refund_amount,
    0,
  );

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Refunds"
        description="Review automatic refund status and complete manual follow-up."
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Pending" value={String(pendingRefunds.length)} />
        <SummaryCard label="Needs action" tone="danger" value={String(actionableRefunds.length)} />
        <SummaryCard label="Action amount" tone="danger" value={formatCurrency(actionAmount)} />
        <SummaryCard label="Completed total" value={formatCurrency(totalRefunded)} />
      </div>

      {actionableRefunds.length > 0 ? (
        <section className="space-y-4">
          <div className="flex items-center gap-2 text-rose-700">
            <AlertTriangle className="size-4" />
            <h2 className="text-lg font-semibold">Refunds Needing Action</h2>
            <Badge className="bg-rose-600 text-white hover:bg-rose-600">Urgent</Badge>
          </div>
          <div className="grid gap-4">
            {actionableRefunds.map((refund) => (
              <ActionRefundCard key={refund.id} refund={refund} />
            ))}
          </div>
        </section>
      ) : null}

      <section className="space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground">All Refunds</h2>
            <p className="text-sm text-muted-foreground">
              Filter by status to inspect refund operations.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 rounded-2xl border border-border/70 bg-white p-2">
            {(["all", "pending", "processing", "completed", "failed"] as RefundStatus[]).map(
              (status) => (
                <Button
                  asChild
                  key={status}
                  size="sm"
                  variant={activeStatus === status ? "default" : "ghost"}
                >
                  <Link href={status === "all" ? "/admin/refunds" : `/admin/refunds?status=${status}`}>
                    {status.charAt(0).toUpperCase() + status.slice(1)}
                  </Link>
                </Button>
              ),
            )}
          </div>
        </div>

        <div className="rounded-3xl border border-border/70 bg-white shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Created</TableHead>
                <TableHead>Booking</TableHead>
                <TableHead>Renter</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>HitPay Refund</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {refunds.length === 0 ? (
                <TableRow>
                  <TableCell className="py-8 text-center text-muted-foreground" colSpan={8}>
                    No refunds matched this filter.
                  </TableCell>
                </TableRow>
              ) : (
                refunds.map((refund) => (
                  <TableRow key={refund.id}>
                    <TableCell>{formatDate(refund.created_at)}</TableCell>
                    <TableCell>
                      <Link
                        className="font-medium text-brand-navy hover:underline"
                        href={`/admin/bookings/${refund.booking_id}`}
                      >
                        {refund.booking.listing?.title ?? refund.booking_id.slice(0, 8)}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link
                        className="hover:underline"
                        href={`/admin/users/${refund.renter_id}`}
                      >
                        {refund.renter.display_name ||
                          refund.renter.full_name ||
                          refund.renter.email}
                      </Link>
                    </TableCell>
                    <TableCell className="max-w-[220px]">
                      <p className="capitalize">{refund.refund_reason.replaceAll("_", " ")}</p>
                      <RefundPolicyDetails compact refund={refund} />
                      {refund.failure_reason ? (
                        <p className="mt-1 text-xs text-rose-700">{refund.failure_reason}</p>
                      ) : null}
                    </TableCell>
                    <TableCell className="font-semibold">
                      {formatCurrency(refund.refund_amount, refund.currency)}
                      <RefundAmountBreakdown compact refund={refund} />
                    </TableCell>
                    <TableCell>
                      <RefundStatusBadge status={refund.status} />
                    </TableCell>
                    <TableCell>{refund.hitpay_refund_id ?? "-"}</TableCell>
                    <TableCell className="text-right">
                      <RefundActions refund={refund} />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </section>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "danger";
}) {
  return (
    <div
      className={cn(
        "rounded-3xl border p-5 shadow-sm",
        tone === "danger"
          ? "border-rose-200 bg-rose-50"
          : "border-border/70 bg-white",
      )}
    >
      <p className={cn("text-sm", tone === "danger" ? "text-rose-700" : "text-muted-foreground")}>
        {label}
      </p>
      <p
        className={cn(
          "mt-2 text-3xl font-semibold",
          tone === "danger" ? "text-rose-700" : "text-brand-navy",
        )}
      >
        {value}
      </p>
    </div>
  );
}

function RefundStatusBadge({ status }: { status: Refund["status"] }) {
  return <Badge className={statusTone[status]}>{status}</Badge>;
}

function ActionRefundCard({ refund }: { refund: AdminRefundRow }) {
  const renterName =
    refund.renter.display_name || refund.renter.full_name || refund.renter.email;

  return (
    <div className="rounded-3xl border border-rose-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-lg font-semibold text-foreground">{renterName}</p>
            <RefundStatusBadge status={refund.status} />
          </div>
          <p className="text-sm text-muted-foreground">
            {refund.booking.listing?.title ?? `Booking ${refund.booking_id.slice(0, 8)}`} -{" "}
            {formatCurrency(refund.refund_amount, refund.currency)}
          </p>
          <RefundPolicyDetails refund={refund} />
          <RefundAmountBreakdown refund={refund} />
          <p className="text-sm text-rose-700">
            {refund.failure_reason ?? "Manual processing or retry is required."}
          </p>
          {refund.transaction?.external_reference ? (
            <p className="text-sm text-muted-foreground">
              Manual reference: {refund.transaction.external_reference}
            </p>
          ) : null}
          {refund.note ? (
            <p className="max-w-3xl text-sm text-muted-foreground">{refund.note}</p>
          ) : null}
          <div className="flex flex-wrap gap-3 text-sm">
            <Link className="font-medium text-brand-navy hover:underline" href={`/admin/bookings/${refund.booking_id}`}>
              View booking
            </Link>
            <Link className="font-medium text-brand-navy hover:underline" href={`/admin/transactions?booking_id=${refund.booking_id}`}>
              View transactions
            </Link>
          </div>
        </div>
        <RefundActions refund={refund} />
      </div>
    </div>
  );
}

function getPolicyText(refund: Refund) {
  const policy = refund.cancellation_policy?.replaceAll("_", " ") ?? "not recorded";
  const hoursSincePayment = refund.hours_before_start;

  if (typeof hoursSincePayment === "number") {
    return `${policy} policy - ${hoursSincePayment} hours since payment`;
  }

  return `${policy} policy`;
}

function RefundPolicyDetails({
  refund,
  compact = false,
}: {
  refund: Refund;
  compact?: boolean;
}) {
  return (
    <p className={cn("text-muted-foreground", compact ? "mt-1 text-xs" : "text-sm")}>
      {getPolicyText(refund)}
    </p>
  );
}

function RefundAmountBreakdown({
  refund,
  compact = false,
}: {
  refund: Refund;
  compact?: boolean;
}) {
  const items = [
    `Deposit ${formatCurrency(refund.deposit_refund ?? 0, refund.currency)}`,
    `Cancellation fee ${formatCurrency(refund.cancellation_fee ?? 0, refund.currency)}`,
    `Platform retained ${formatCurrency(refund.platform_fee_retained ?? 0, refund.currency)}`,
  ];

  return (
    <p className={cn("text-muted-foreground", compact ? "mt-1 text-xs font-normal" : "text-sm")}>
      {items.join(" | ")}
    </p>
  );
}
