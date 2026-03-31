"use client";

import { format } from "date-fns";
import { useState, useTransition } from "react";
import {
  CheckCircle2,
  Loader2,
  ShieldAlert,
  Truck,
  XCircle,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  acceptBookingRequest,
  cancelBooking,
  declineBookingRequest,
  markItemHandedOver,
  markItemReturned,
  markOutForDelivery,
  raiseDispute,
} from "@/actions/bookings";
import { ConditionCheckForm } from "@/components/bookings/condition-check-form";
import { PaymentCountdown } from "@/components/bookings/payment-countdown";
import { DualReviewForm } from "@/components/reviews/dual-review-form";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
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
import { formatCurrency } from "@/lib/utils";
import type { BookingWithDetails } from "@/types";

interface RequestActionsProps {
  booking: BookingWithDetails;
}

function formatDateTime(value?: string | null) {
  if (!value) {
    return "Not scheduled";
  }

  return format(new Date(value), "PPP p");
}

export function RequestActions({ booking }: RequestActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [deliveryNotes, setDeliveryNotes] = useState("");
  const [disputeReason, setDisputeReason] = useState("");

  function runAction(action: () => Promise<{ success?: string; error?: string }>) {
    startTransition(async () => {
      const result = await action();

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success(result.success ?? "Booking updated.");
      router.refresh();
    });
  }

  if (booking.status === "pending") {
    return (
      <div className="flex flex-wrap justify-end gap-2">
        <Button
          className="bg-emerald-600 text-white hover:bg-emerald-700"
          disabled={isPending}
          onClick={() => runAction(() => acceptBookingRequest(booking.id))}
          type="button"
        >
          {isPending ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
          Accept
        </Button>
        <ConfirmDialog
          confirmLabel="Decline Booking"
          description="This will decline the request and notify the renter."
          onConfirm={async () => {
            const result = await declineBookingRequest(booking.id, "Declined by lister.");

            if (result.error) {
              toast.error(result.error);
              return;
            }

            toast.success(result.success ?? "Booking declined.");
            router.refresh();
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

  if (booking.status === "awaiting_payment") {
    return (
      <div className="space-y-3 text-right">
        <p className="text-sm font-medium text-muted-foreground">Waiting for payment</p>
        {booking.payment_expires_at ? (
          <PaymentCountdown expiresAt={booking.payment_expires_at} />
        ) : null}
        <ConfirmDialog
          confirmLabel="Cancel Booking"
          description="Cancel this booking if the renter is taking too long to pay."
          onConfirm={async () => {
            const result = await cancelBooking(booking.id, "Payment window expired or cancelled by lister.");

            if (result.error) {
              toast.error(result.error);
              return;
            }

            toast.success(result.success ?? "Booking cancelled.");
            router.refresh();
          }}
          title="Cancel this unpaid booking?"
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

  if (booking.status === "confirmed") {
    if (booking.fulfillment_type === "delivery") {
      return (
        <Dialog>
          <DialogTrigger asChild>
            <Button type="button">
              <Truck className="size-4" />
              Mark as Shipped
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Mark Out for Delivery</DialogTitle>
              <DialogDescription>
                Add optional delivery notes before marking this booking in transit.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label htmlFor={`delivery-notes-${booking.id}`}>Delivery Notes</Label>
              <Textarea
                id={`delivery-notes-${booking.id}`}
                onChange={(event) => setDeliveryNotes(event.target.value)}
                placeholder="Optional delivery notes..."
                rows={4}
                value={deliveryNotes}
              />
            </div>
            <DialogFooter>
              <Button
                disabled={isPending}
                onClick={() => runAction(() => markOutForDelivery(booking.id, deliveryNotes))}
                type="button"
              >
                {isPending ? <Loader2 className="size-4 animate-spin" /> : null}
                Mark as Shipped / Out for Delivery
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      );
    }

    return (
      <Button
        disabled={isPending}
        onClick={() => runAction(() => markItemHandedOver(booking.id))}
        type="button"
      >
        {isPending ? <Loader2 className="size-4 animate-spin" /> : null}
        Mark as Picked Up
      </Button>
    );
  }

  if (booking.status === "out_for_delivery") {
    return (
      <Button
        disabled={isPending}
        onClick={() => runAction(() => markItemHandedOver(booking.id))}
        type="button"
      >
        {isPending ? <Loader2 className="size-4 animate-spin" /> : null}
        Confirm Delivered
      </Button>
    );
  }

  if (booking.status === "active") {
    return (
      <div className="space-y-3 text-right">
        {booking.return_scheduled_at ? (
          <p className="text-sm text-muted-foreground">
            Return scheduled: {formatDateTime(booking.return_scheduled_at)}
          </p>
        ) : null}
        <div className="flex flex-wrap justify-end gap-2">
          <Button
            disabled={isPending}
            onClick={() => runAction(() => markItemReturned(booking.id))}
            type="button"
          >
            {isPending ? <Loader2 className="size-4 animate-spin" /> : null}
            Mark Item Returned
          </Button>

          <Dialog>
            <DialogTrigger asChild>
              <Button type="button" variant="outline">
                <ShieldAlert className="size-4" />
                Raise Dispute
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Raise Dispute</DialogTitle>
                <DialogDescription>
                  Explain the issue so the platform team can review it.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-2">
                <Label htmlFor={`dispute-reason-${booking.id}`}>Reason</Label>
                <Textarea
                  id={`dispute-reason-${booking.id}`}
                  onChange={(event) => setDisputeReason(event.target.value)}
                  rows={4}
                  value={disputeReason}
                />
              </div>
              <DialogFooter>
                <Button
                  disabled={isPending || disputeReason.trim().length < 5}
                  onClick={() => runAction(() => raiseDispute(booking.id, disputeReason))}
                  type="button"
                  variant="outline"
                >
                  Raise Dispute
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    );
  }

  if (booking.status === "returned") {
    return <ConditionCheckForm booking={booking} />;
  }

  if (booking.status === "completed") {
    return (
      <div className="space-y-3 text-right">
        <div className="text-sm text-muted-foreground">
          <p>Completed successfully</p>
          <p>Payout: {formatCurrency(booking.lister_payout)}</p>
        </div>
        {!booking.lister_reviewed ? (
          <DualReviewForm
            booking={booking}
            currentUserId={booking.lister_id}
            trigger={
              <Button type="button" variant="outline">
                Leave Review
              </Button>
            }
          />
        ) : null}
      </div>
    );
  }

  return null;
}
