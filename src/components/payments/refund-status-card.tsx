import { AlertTriangle, CheckCircle2, CircleDot, LoaderCircle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import type { Refund } from "@/types";

type RefundStatusCardProps = {
  refund: Refund;
};

const reasonLabel: Record<string, string> = {
  booking_cancelled_by_renter: "Booking cancelled by renter",
  booking_cancelled_by_lister: "Booking cancelled by lister",
  booking_declined: "Booking declined",
  payment_expired: "Payment expired",
  dispute_resolved_renter: "Dispute resolved in renter's favor",
  dispute_split: "Split dispute resolution",
  admin_manual_refund: "Manual admin refund",
};

const statusTone: Record<Refund["status"], string> = {
  pending: "bg-amber-100 text-amber-900",
  processing: "bg-sky-100 text-sky-900",
  completed: "bg-emerald-100 text-emerald-900",
  failed: "bg-rose-100 text-rose-900",
};

function getStatusMessage(refund: Refund) {
  if (refund.status === "completed") {
    return `Refund processed ${formatDate(refund.processed_at ?? refund.updated_at)}. May take 5-10 business days.`;
  }

  if (refund.status === "failed") {
    return "Refund failed — admin has been notified.";
  }

  return "Your refund is being processed...";
}

function getStatusIcon(status: Refund["status"]) {
  switch (status) {
    case "completed":
      return CheckCircle2;
    case "failed":
      return AlertTriangle;
    case "processing":
      return LoaderCircle;
    default:
      return CircleDot;
  }
}

export function RefundStatusCard({ refund }: RefundStatusCardProps) {
  const StatusIcon = getStatusIcon(refund.status);

  return (
    <section className="rounded-3xl border border-border/70 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-foreground">Refund status</p>
          <p className="text-sm text-muted-foreground">{getStatusMessage(refund)}</p>
        </div>
        <Badge className={cn("capitalize", statusTone[refund.status])}>{refund.status}</Badge>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl bg-slate-50 p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
            Original Amount Paid
          </p>
          <p className="mt-2 text-lg font-semibold text-brand-navy">
            {formatCurrency(refund.original_amount, refund.currency)}
          </p>
        </div>
        <div className="rounded-2xl bg-emerald-50 p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-emerald-700">
            Refund Amount
          </p>
          <p className="mt-2 text-lg font-semibold text-brand-sky">
            {formatCurrency(refund.refund_amount, refund.currency)}
          </p>
        </div>
        <div className="rounded-2xl bg-rose-50 p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-rose-700">
            Cancellation Fee
          </p>
          <p className="mt-2 text-lg font-semibold text-rose-600">
            {refund.cancellation_fee > 0
              ? formatCurrency(refund.cancellation_fee, refund.currency)
              : "None"}
          </p>
        </div>
      </div>

      <div className="mt-5 rounded-2xl border border-border/70 bg-slate-50/80 p-4">
        <div className="flex gap-3">
          <div className="flex flex-col items-center">
            <span className="flex size-9 items-center justify-center rounded-full bg-brand-navy/10 text-brand-navy">
              <StatusIcon className={cn("size-4", refund.status === "processing" && "animate-spin")} />
            </span>
            <span className="mt-2 h-full w-px bg-border" />
          </div>
          <div className="flex-1 space-y-4 pb-1">
            <div>
              <p className="text-sm font-medium text-foreground">Refund created</p>
              <p className="text-sm text-muted-foreground">{formatDate(refund.created_at)}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Reason</p>
              <p className="text-sm text-muted-foreground">
                {reasonLabel[refund.refund_reason] ?? refund.refund_reason.replaceAll("_", " ")}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">
                Cancellation policy applied
              </p>
              <p className="text-sm text-muted-foreground">
                {refund.cancellation_policy ?? "Platform policy"}
              </p>
            </div>
            {refund.note ? (
              <div>
                <p className="text-sm font-medium text-foreground">Notes</p>
                <p className="text-sm text-muted-foreground">{refund.note}</p>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
