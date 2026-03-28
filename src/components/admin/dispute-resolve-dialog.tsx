"use client";

import { useState, useTransition } from "react";

import { resolveDispute } from "@/actions/admin";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { BookingStatus, BookingWithDetails } from "@/types";

type ResolutionPreset = "renter" | "lister" | "custom";

const presetStatus: Record<ResolutionPreset, BookingStatus> = {
  renter: "cancelled_by_lister",
  lister: "completed",
  custom: "completed",
};

export function DisputeResolveDialog({
  booking,
  trigger,
  onComplete,
}: {
  booking: BookingWithDetails;
  trigger: React.ReactNode;
  onComplete?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [preset, setPreset] = useState<ResolutionPreset>("renter");
  const [status, setStatus] = useState<BookingStatus>(presetStatus.renter);
  const [details, setDetails] = useState("");
  const [isPending, startTransition] = useTransition();

  function handlePresetChange(value: string) {
    const nextPreset = value as ResolutionPreset;
    setPreset(nextPreset);
    setStatus(presetStatus[nextPreset]);
  }

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Resolve dispute</DialogTitle>
          <DialogDescription>
            Choose a resolution path, set the resulting booking status, and capture admin notes.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-2xl border border-orange-100 bg-orange-50/30 p-4 text-sm">
          <p className="font-medium text-foreground">{booking.listing.title}</p>
          <p className="text-muted-foreground">
            {formatDate(booking.start_date)} - {formatDate(booking.end_date)} · Qty {booking.quantity}
          </p>
          <p className="mt-1 text-muted-foreground">
            Total: {formatCurrency(booking.total_price)} · Status: {booking.status}
          </p>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="resolution-preset">Resolution path</Label>
            <Select onValueChange={handlePresetChange} value={preset}>
              <SelectTrigger id="resolution-preset" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="renter">Resolve in Renter&apos;s Favor</SelectItem>
                <SelectItem value="lister">Resolve in Lister&apos;s Favor</SelectItem>
                <SelectItem value="custom">Custom Resolution</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="new-status">New status</Label>
            <Select onValueChange={(value) => setStatus(value as BookingStatus)} value={status}>
              <SelectTrigger id="new-status" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="cancelled_by_lister">Cancelled by Lister</SelectItem>
                <SelectItem value="cancelled_by_renter">Cancelled by Renter</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="confirmed">Confirmed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="resolution-details">Resolution details</Label>
            <Textarea
              id="resolution-details"
              onChange={(event) => setDetails(event.target.value)}
              placeholder="Explain the outcome, refund expectations, and operational follow-up"
              rows={5}
              value={details}
            />
          </div>
        </div>

        <DialogFooter>
          <Button onClick={() => setOpen(false)} type="button" variant="outline">
            Cancel
          </Button>
          <Button
            className="bg-orange-600 text-white hover:bg-orange-700"
            disabled={isPending || details.trim().length < 3}
            onClick={() =>
              startTransition(async () => {
                await resolveDispute(booking.id, details.trim(), status);
                setOpen(false);
                onComplete?.();
              })
            }
            type="button"
          >
            {isPending ? "Resolving..." : "Resolve Dispute"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
