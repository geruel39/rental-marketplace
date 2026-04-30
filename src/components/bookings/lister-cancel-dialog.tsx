"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { listerCancelBooking } from "@/actions/bookings";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
import type { BookingWithDetails } from "@/types";

interface ListerCancelDialogProps {
  booking: BookingWithDetails;
  triggerClassName?: string;
  triggerLabel?: string;
}

export function ListerCancelDialog({
  booking,
  triggerClassName,
  triggerLabel = "Cancel",
}: ListerCancelDialogProps) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [isPending, startTransition] = useTransition();

  function submit() {
    const trimmedReason = reason.trim();
    if (trimmedReason.length < 5) {
      toast.error("Please provide a short reason.");
      return;
    }

    const formData = new FormData();
    formData.set("booking_id", booking.id);
    formData.set("reason", trimmedReason);

    startTransition(async () => {
      const result = await listerCancelBooking(null, formData);
      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success(result.success ?? "Booking cancelled.");
      setOpen(false);
      window.location.reload();
    });
  }

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger asChild>
        <Button
          className={triggerClassName}
          type="button"
          variant="destructive"
        >
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cancel Booking</DialogTitle>
          <DialogDescription>
            This gives the renter a full refund and pauses the listing.
          </DialogDescription>
        </DialogHeader>

        <Alert variant="destructive">
          <AlertDescription>
            Listing will be paused immediately after cancellation.
          </AlertDescription>
        </Alert>

        <div className="space-y-2">
          <Label htmlFor={`lister-cancel-reason-${booking.id}`}>Reason</Label>
          <Textarea
            id={`lister-cancel-reason-${booking.id}`}
            maxLength={500}
            onChange={(event) => setReason(event.target.value)}
            rows={4}
            value={reason}
          />
        </div>

        <DialogFooter>
          <Button
            className="min-w-44"
            disabled={isPending}
            onClick={submit}
            type="button"
            variant="destructive"
          >
            {isPending ? <Loader2 className="size-4 animate-spin" /> : null}
            {isPending ? "Cancelling..." : "Confirm Cancellation"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
