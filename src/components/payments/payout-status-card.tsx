"use client";

import { Building2, CreditCard, Loader2, Smartphone } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { retryFailedPayout } from "@/actions/payments";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import type { Payout } from "@/types";

type PayoutStatusCardProps = {
  payout: Payout;
  maxRetryCount?: number;
};

const statusTone: Record<Payout["status"], string> = {
  pending: "bg-amber-100 text-amber-900",
  processing: "bg-sky-100 text-sky-900",
  completed: "bg-emerald-100 text-emerald-900",
  failed: "bg-rose-100 text-rose-900",
};

function getPayoutMethodMeta(method: string | null) {
  switch (method) {
    case "bank":
      return { label: "Bank transfer", icon: Building2 };
    case "maya":
      return { label: "Maya", icon: CreditCard };
    case "gcash":
      return { label: "GCash", icon: Smartphone };
    default:
      return { label: "Manual payout", icon: Building2 };
  }
}

function getTriggerLabel(trigger: Payout["trigger_type"]) {
  switch (trigger) {
    case "auto_after_completion":
      return "Automatic after booking completion";
    case "admin_manual":
      return "Manual admin release";
    case "dispute_resolved":
      return "Dispute resolution";
    case "retry_after_failure":
      return "Retry after failure";
    default:
      return String(trigger).replaceAll("_", " ");
  }
}

export function PayoutStatusCard({
  payout,
  maxRetryCount = 3,
}: PayoutStatusCardProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const method = getPayoutMethodMeta(payout.payout_method);
  const MethodIcon = method.icon;

  function handleRetry() {
    startTransition(async () => {
      const result = await retryFailedPayout(payout.id);
      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success(result.success ?? "Retry requested");
      router.refresh();
    });
  }

  return (
    <section className="rounded-3xl border border-border/70 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Payout status</p>
          <p className="mt-2 text-3xl font-semibold text-brand-navy">
            {formatCurrency(payout.amount, payout.currency)}
          </p>
        </div>
        <Badge className={cn("px-3 py-1 capitalize", statusTone[payout.status])}>
          {payout.status}
        </Badge>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl bg-slate-50 p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Via</p>
          <p className="mt-2 inline-flex items-center gap-2 font-medium text-foreground">
            <MethodIcon className="size-4 text-brand-navy" />
            {method.label}
          </p>
        </div>
        <div className="rounded-2xl bg-slate-50 p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Triggered</p>
          <p className="mt-2 font-medium text-foreground">{getTriggerLabel(payout.trigger_type)}</p>
        </div>
      </div>

      {payout.status === "completed" ? (
        <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950">
          <p>Processed {formatDate(payout.processed_at ?? payout.updated_at)}</p>
          <p className="mt-1">Reference: {payout.reference_number ?? "Generated in payout log"}</p>
        </div>
      ) : null}

      {(payout.status === "pending" || payout.status === "processing") ? (
        <div className="mt-5 rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-950">
          Your payout is being processed.
        </div>
      ) : null}

      {payout.status === "failed" ? (
        <div className="mt-5 space-y-4">
          <Alert className="border-rose-200 bg-rose-50 text-rose-950">
            <AlertDescription>
              Payout failed: {payout.failure_reason ?? "No failure reason was recorded."}
            </AlertDescription>
          </Alert>

          <div className="flex flex-wrap gap-3">
            <Button asChild variant="outline">
              <Link href="/dashboard/settings/payments">Update Payout Settings</Link>
            </Button>
            {payout.can_retry ? (
              <Button
                className="bg-brand-navy text-white hover:bg-brand-steel"
                disabled={isPending}
                onClick={handleRetry}
                type="button"
              >
                {isPending ? <Loader2 className="size-4 animate-spin" /> : null}
                Request Retry
              </Button>
            ) : null}
          </div>

          <p className="text-sm text-muted-foreground">
            Retry count: {payout.retry_count}/{maxRetryCount} attempts used
          </p>
        </div>
      ) : null}
    </section>
  );
}
