"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { processPayoutToLister } from "@/actions/payments";
import { PayoutDetailsDisplay } from "@/components/payout/payout-details-display";
import { PayoutMethodBadge } from "@/components/payout/payout-method-badge";
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
import { formatCurrency } from "@/lib/utils";
import type { Payout, Profile } from "@/types";

type PayoutProcessDialogProps = {
  payout: Payout & {
    lister: Profile;
  };
  trigger: React.ReactNode;
  onComplete?: () => void;
};

export function PayoutProcessDialog({
  payout,
  trigger,
  onComplete,
}: PayoutProcessDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const listerName =
    payout.lister.display_name || payout.lister.full_name || payout.lister.email;
  const payoutMethod = payout.lister.payout_method ?? "bank";

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Process payout</DialogTitle>
          <DialogDescription>
            Confirm payout details before triggering the release to the lister.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-2xl border border-brand-navy/10 bg-brand-light p-4 text-sm">
            <p className="font-medium text-foreground">{listerName}</p>
            <p className="text-muted-foreground">{payout.lister.email}</p>
            <p className="mt-2 text-muted-foreground">
              Booking reference: {payout.booking_id?.slice(0, 8) || "Manual payout"}
            </p>
            <p className="mt-1 text-lg font-semibold text-foreground">
              {formatCurrency(payout.amount, payout.currency)}
            </p>
          </div>

          <div className="rounded-2xl border border-brand-navy/10 bg-white p-4 text-sm">
            <div className="mb-3 flex items-center gap-3">
              <p className="font-medium text-foreground">Payout details</p>
              <PayoutMethodBadge method={payoutMethod} size="sm" />
            </div>
            <PayoutDetailsDisplay
              masked={false}
              payoutDetails={{
                method: payoutMethod,
                bank_name: payout.lister.bank_name ?? undefined,
                bank_account_number: payout.lister.bank_account_number ?? undefined,
                bank_account_name: payout.lister.bank_account_name ?? undefined,
                gcash_phone_number: payout.lister.gcash_phone_number ?? undefined,
                maya_phone_number: payout.lister.maya_phone_number ?? undefined,
              }}
              showCopyButtons
            />
          </div>
        </div>

        <DialogFooter>
          <Button onClick={() => setOpen(false)} type="button" variant="outline">
            Cancel
          </Button>
          <Button
            className="bg-brand-navy text-white hover:bg-brand-steel"
            disabled={isPending}
            onClick={() =>
              startTransition(async () => {
                const result = await processPayoutToLister(payout.id);
                if ("error" in result) {
                  toast.error(result.error);
                  return;
                }
                toast.success(result.message);
                setOpen(false);
                router.refresh();
                onComplete?.();
              })
            }
            type="button"
          >
            {isPending ? "Processing..." : "Confirm Payout"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
