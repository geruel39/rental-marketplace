"use client";

import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn, formatCurrency, formatDate, formatTransactionStatus, formatTransactionType } from "@/lib/utils";
import type { Transaction } from "@/types";

type TransactionListProps = {
  transactions: Transaction[];
  showBookingRef?: boolean;
};

const PAGE_SIZE = 8;

function getTransactionTone(eventType: Transaction["event_type"]) {
  if (eventType === "payment_completed") return "bg-sky-100 text-sky-900";
  if (eventType === "payout_completed") return "bg-emerald-100 text-emerald-900";
  if (eventType === "refund_completed") return "bg-orange-100 text-orange-900";
  if (eventType.startsWith("dispute_")) return "bg-rose-100 text-rose-900";
  return "bg-slate-100 text-slate-800";
}

function getSignedAmount(transaction: Transaction) {
  switch (transaction.event_type) {
    case "refund_initiated":
    case "refund_completed":
    case "refund_failed":
    case "payment_failed":
    case "payment_expired":
    case "payout_failed":
    case "dispute_hold":
      return -Math.abs(transaction.gross_amount);
    default:
      return Math.abs(transaction.net_amount || transaction.gross_amount);
  }
}

function getReference(transaction: Transaction) {
  return (
    transaction.external_reference ||
    transaction.hitpay_payment_id ||
    transaction.hitpay_payment_request_id ||
    transaction.booking_id ||
    transaction.id.slice(0, 8)
  );
}

export function TransactionList({
  transactions,
  showBookingRef = false,
}: TransactionListProps) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(transactions.length / PAGE_SIZE));

  const pageTransactions = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return transactions.slice(start, start + PAGE_SIZE);
  }, [page, transactions]);

  if (transactions.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-border/70 bg-slate-50 px-6 py-10 text-center">
        <p className="text-base font-medium text-foreground">No transactions yet</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Payment, payout, refund, and dispute activity will show up here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-3xl border border-border/70 bg-white shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Event type</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Status</TableHead>
              {showBookingRef ? <TableHead>Booking</TableHead> : null}
              <TableHead>Reference</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageTransactions.map((transaction) => {
              const amount = getSignedAmount(transaction);
              const status = formatTransactionStatus(transaction.status);

              return (
                <TableRow key={transaction.id}>
                  <TableCell>{formatDate(transaction.processed_at ?? transaction.created_at)}</TableCell>
                  <TableCell>
                    <Badge className={cn("whitespace-nowrap", getTransactionTone(transaction.event_type))}>
                      {formatTransactionType(transaction.event_type)}
                    </Badge>
                  </TableCell>
                  <TableCell
                    className={cn(
                      "font-semibold",
                      amount >= 0 ? "text-emerald-600" : "text-rose-600",
                    )}
                  >
                    {amount >= 0 ? "+" : "-"}
                    {formatCurrency(Math.abs(amount), transaction.currency)}
                  </TableCell>
                  <TableCell>
                    <Badge className={status.color}>{status.label}</Badge>
                  </TableCell>
                  {showBookingRef ? (
                    <TableCell>{transaction.booking_id?.slice(0, 8) ?? "-"}</TableCell>
                  ) : null}
                  <TableCell className="text-muted-foreground">{getReference(transaction)}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 ? (
        <div className="flex justify-end gap-2">
          <button
            className="rounded-xl border border-border px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
            disabled={page <= 1}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            type="button"
          >
            Previous
          </button>
          <div className="rounded-xl bg-slate-100 px-3 py-2 text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </div>
          <button
            className="rounded-xl border border-border px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
            disabled={page >= totalPages}
            onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
            type="button"
          >
            Next
          </button>
        </div>
      ) : null}
    </div>
  );
}
