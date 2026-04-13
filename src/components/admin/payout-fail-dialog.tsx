"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { markPayoutFailedByAdmin } from "@/actions/payments";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Payout } from "@/types";

export function PayoutFailDialog({
  payout,
  trigger,
  onComplete,
}: {
  payout: Payout;
  trigger: React.ReactNode;
  onComplete?: () => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [isPending, startTransition] = useTransition();

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Mark payout as failed</DialogTitle>
          <DialogDescription>
            Capture the failure reason so the lister can retry after updating details.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor={`reason-${payout.id}`}>Failure reason</Label>
          <Textarea
            id={`reason-${payout.id}`}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Invalid account details, transfer rejected, wallet unavailable..."
            rows={4}
            value={reason}
          />
        </div>

        <DialogFooter>
          <Button onClick={() => setOpen(false)} type="button" variant="outline">
            Cancel
          </Button>
          <Button
            className="bg-rose-600 text-white hover:bg-rose-700"
            disabled={isPending || reason.trim().length < 3}
            onClick={() =>
              startTransition(async () => {
                const result = await markPayoutFailedByAdmin(payout.id, reason);
                if (result.error) {
                  toast.error(result.error);
                  return;
                }

                toast.success(result.success ?? "Payout updated");
                setOpen(false);
                router.refresh();
                onComplete?.();
              })
            }
            type="button"
          >
            {isPending ? "Saving..." : "Reject"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
