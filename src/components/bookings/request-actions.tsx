"use client";

import { useTransition } from "react";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { toast } from "sonner";

import {
  acceptBookingRequest,
  cancelBooking,
  completeBooking,
  declineBookingRequest,
} from "@/actions/bookings";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import type { BookingWithDetails } from "@/types";

interface RequestActionsProps {
  booking: BookingWithDetails;
}

export function RequestActions({ booking }: RequestActionsProps) {
  const [isPending, startTransition] = useTransition();

  async function handleAction(action: () => Promise<{ success?: string; error?: string }>) {
    startTransition(async () => {
      const result = await action();

      if (result?.error) {
        toast.error(result.error);
        return;
      }

      if (result?.success) {
        toast.success(result.success);
      }
    });
  }

  if (booking.status === "pending") {
    return (
      <div className="flex shrink-0 flex-wrap gap-2">
        <Button
          className="bg-emerald-600 text-white hover:bg-emerald-700"
          disabled={isPending}
          onClick={() => handleAction(() => acceptBookingRequest(booking.id))}
          type="button"
        >
          {isPending ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
          Accept
        </Button>
        <ConfirmDialog
          confirmLabel="Decline Booking"
          description="This will cancel the booking request and notify the renter."
          onConfirm={async () => {
            const result = await declineBookingRequest(
              booking.id,
              "Declined from the booking requests dashboard",
            );

            if (result?.error) {
              toast.error(result.error);
              return;
            }

            toast.success(result.success ?? "Booking declined");
          }}
          title="Decline this booking request?"
          trigger={
            <Button disabled={isPending} type="button" variant="outline">
              <XCircle className="size-4" />
              Decline
            </Button>
          }
          variant="destructive"
        />
      </div>
    );
  }

  if (booking.status === "confirmed" || booking.status === "active") {
    return (
      <div className="flex shrink-0 flex-wrap gap-2">
        <Button
          disabled={isPending}
          onClick={() => handleAction(() => completeBooking(booking.id))}
          type="button"
        >
          {isPending ? <Loader2 className="size-4 animate-spin" /> : null}
          Complete
        </Button>
        <ConfirmDialog
          confirmLabel="Cancel Booking"
          description="This will cancel the booking and release reserved stock if needed."
          onConfirm={async () => {
            const result = await cancelBooking(
              booking.id,
              "Cancelled from the booking requests dashboard",
            );

            if (result?.error) {
              toast.error(result.error);
              return;
            }

            toast.success(result.success ?? "Booking cancelled");
          }}
          title="Cancel this booking?"
          trigger={
            <Button disabled={isPending} type="button" variant="outline">
              Cancel
            </Button>
          }
          variant="destructive"
        />
      </div>
    );
  }

  return null;
}
