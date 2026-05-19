"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  markRefundFailed,
  markRefundManuallyProcessed,
  retryRefund,
} from "@/actions/payments";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency } from "@/lib/utils";
import type { Refund } from "@/types";

type RefundActionsProps = {
  refund: Refund;
};

export function RefundActions({ refund }: RefundActionsProps) {
  const router = useRouter();
  const [isRetrying, startRetryTransition] = useTransition();

  if (refund.status === "completed") {
    return null;
  }

  return (
    <div className="flex flex-wrap justify-end gap-2">
      <Button
        className="bg-brand-navy text-white hover:bg-brand-steel"
        disabled={isRetrying}
        onClick={() =>
          startRetryTransition(async () => {
            const result = await retryRefund(refund.id);
            if ("error" in result) {
              toast.error(result.error);
              router.refresh();
              return;
            }
            toast.success(result.success ?? "Refund retried.");
            router.refresh();
          })
        }
        size="sm"
        type="button"
      >
        {isRetrying ? "Retrying..." : "Retry HitPay"}
      </Button>
      <ManualRefundDialog refund={refund} />
      <FailRefundDialog refund={refund} />
    </div>
  );
}

function ManualRefundDialog({ refund }: RefundActionsProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger asChild>
        <Button size="sm" type="button" variant="outline">
          Mark Manual
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Mark refund manually processed</DialogTitle>
          <DialogDescription>
            Use this after confirming the renter received{" "}
            {formatCurrency(refund.refund_amount, refund.currency)} outside the automatic
            HitPay flow.
          </DialogDescription>
        </DialogHeader>

        <form
          action={(formData) =>
            startTransition(async () => {
              const result = await markRefundManuallyProcessed(null, formData);
              if ("error" in result) {
                toast.error(result.error);
                return;
              }
              toast.success(result.success ?? "Refund marked processed.");
              setOpen(false);
              router.refresh();
            })
          }
          className="space-y-4"
        >
          <input name="refund_id" type="hidden" value={refund.id} />
          <div className="space-y-2">
            <Label htmlFor={`manual-reference-${refund.id}`}>Reference</Label>
            <Input
              id={`manual-reference-${refund.id}`}
              name="reference"
              placeholder="Bank transfer, support ticket, or HitPay dashboard reference"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`manual-note-${refund.id}`}>Admin note</Label>
            <Textarea
              id={`manual-note-${refund.id}`}
              name="note"
              placeholder="Describe how the refund was completed."
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button
              disabled={isPending}
              onClick={() => setOpen(false)}
              type="button"
              variant="outline"
            >
              Cancel
            </Button>
            <Button
              className="bg-brand-navy text-white hover:bg-brand-steel"
              disabled={isPending}
              type="submit"
            >
              {isPending ? "Saving..." : "Mark Completed"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function FailRefundDialog({ refund }: RefundActionsProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger asChild>
        <Button size="sm" type="button" variant="outline">
          Mark Failed
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Mark refund failed</DialogTitle>
          <DialogDescription>
            Record why this refund cannot be completed right now.
          </DialogDescription>
        </DialogHeader>

        <form
          action={(formData) =>
            startTransition(async () => {
              const result = await markRefundFailed(null, formData);
              if ("error" in result) {
                toast.error(result.error);
                return;
              }
              toast.success(result.success ?? "Refund marked failed.");
              setOpen(false);
              router.refresh();
            })
          }
          className="space-y-4"
        >
          <input name="refund_id" type="hidden" value={refund.id} />
          <div className="space-y-2">
            <Label htmlFor={`failure-reason-${refund.id}`}>Failure reason</Label>
            <Textarea
              id={`failure-reason-${refund.id}`}
              name="reason"
              placeholder="Explain the blocker or required follow-up."
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button
              disabled={isPending}
              onClick={() => setOpen(false)}
              type="button"
              variant="outline"
            >
              Cancel
            </Button>
            <Button disabled={isPending} type="submit" variant="destructive">
              {isPending ? "Saving..." : "Mark Failed"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
