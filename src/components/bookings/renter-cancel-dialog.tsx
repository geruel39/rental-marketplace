"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { cancelBookingAsRenter } from "@/actions/bookings";
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

interface RenterCancelDialogProps {
  booking: BookingWithDetails;
  refundPreview: string;
  triggerLabel?: string;
  triggerClassName?: string;
}

export function RenterCancelDialog({
  booking,
  refundPreview,
  triggerLabel = "Cancel Booking",
  triggerClassName,
}: RenterCancelDialogProps) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [isPending, startTransition] = useTransition();

  function submit() {
    const formData = new FormData();
    formData.set("booking_id", booking.id);
    formData.set("reason", reason.trim());

    startTransition(async () => {
      const result = await cancelBookingAsRenter(null, formData);
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
        <Button className={triggerClassName} type="button" variant="outline">
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cancel Booking</DialogTitle>
          <DialogDescription>
            Your refund depends on how long it has been since payment.
          </DialogDescription>
        </DialogHeader>

        <Alert>
          <AlertDescription>{refundPreview}</AlertDescription>
        </Alert>

        <div className="space-y-2">
          <Label htmlFor={`renter-cancel-reason-${booking.id}`}>Reason (optional)</Label>
          <Textarea
            id={`renter-cancel-reason-${booking.id}`}
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
