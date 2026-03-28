"use client";

import { useState, useTransition } from "react";

import { processPayout } from "@/actions/admin";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  const [open, setOpen] = useState(false);
  const [method, setMethod] = useState("bank_transfer");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [isPending, startTransition] = useTransition();
  const listerName =
    payout.lister.display_name || payout.lister.full_name || payout.lister.email;
  const bank = payout.lister.payout_bank_account;

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Process payout</DialogTitle>
          <DialogDescription>
            Confirm payout details before marking this payout as completed.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-2xl border border-orange-100 bg-orange-50/30 p-4 text-sm">
            <p className="font-medium text-foreground">{listerName}</p>
            <p className="text-muted-foreground">{payout.lister.email}</p>
            <p className="mt-2 text-muted-foreground">
              Booking reference: {payout.booking_id?.slice(0, 8) || "Manual payout"}
            </p>
            <p className="mt-1 text-lg font-semibold text-foreground">
              {formatCurrency(payout.amount, payout.currency)}
            </p>
          </div>

          <div className="rounded-2xl border border-orange-100 bg-white p-4 text-sm">
            <p className="font-medium text-foreground">Payout settings</p>
            {bank ? (
              <div className="mt-2 space-y-1 text-muted-foreground">
                <p>Bank: {bank.bank_name}</p>
                <p>Account holder: {bank.account_holder}</p>
                <p>Account #: {bank.account_number}</p>
                <p>Routing #: {bank.routing_number}</p>
              </div>
            ) : (
              <p className="mt-2 text-muted-foreground">No bank account on file.</p>
            )}
            {payout.lister.payout_email ? (
              <p className="mt-2 text-muted-foreground">
                Payout email: {payout.lister.payout_email}
              </p>
            ) : null}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="payout-method">Payout method</Label>
              <Select onValueChange={setMethod} value={method}>
                <SelectTrigger id="payout-method" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bank_transfer">Bank transfer</SelectItem>
                  <SelectItem value="paynow">PayNow</SelectItem>
                  <SelectItem value="manual">Manual</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="reference-number">Reference number</Label>
              <Input
                id="reference-number"
                onChange={(event) => setReferenceNumber(event.target.value)}
                placeholder="Transfer or transaction reference"
                value={referenceNumber}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button onClick={() => setOpen(false)} type="button" variant="outline">
            Cancel
          </Button>
          <Button
            className="bg-orange-600 text-white hover:bg-orange-700"
            disabled={isPending || !referenceNumber.trim()}
            onClick={() =>
              startTransition(async () => {
                await processPayout(payout.id, referenceNumber.trim(), method);
                setOpen(false);
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
