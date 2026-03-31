"use client";

import { format } from "date-fns";
import { useState, useTransition } from "react";
import {
  Loader2,
  ShieldAlert,
  Star,
  Truck,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { cancelBooking, raiseDispute } from "@/actions/bookings";
import { PaymentButton } from "@/components/bookings/payment-button";
import { PaymentCountdown } from "@/components/bookings/payment-countdown";
import { ReturnForm } from "@/components/bookings/return-form";
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
import type { BookingWithDetails } from "@/types";

interface RentalActionsProps {
  booking: BookingWithDetails;
}

function formatDateTime(value?: string | null) {
  if (!value) {
    return "Not scheduled";
  }

  return format(new Date(value), "PPP p");
}

export function RentalActions({ booking }: RentalActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [disputeReason, setDisputeReason] = useState("");

  function refreshWithToast(result: { success?: string; error?: string }) {
    if (result.error) {
      toast.error(result.error);
      return;
    }

    toast.success(result.success ?? "Booking updated.");
    router.refresh();
  }

  if (booking.status === "pending") {
    return (
      <div className="space-y-3 text-right">
        <p className="text-sm text-muted-foreground">Waiting for lister</p>
        <ConfirmDialog
          confirmLabel="Cancel Request"
          description="This will cancel your booking request."
          onConfirm={async () => {
            startTransition(async () => {
              const result = await cancelBooking(booking.id, "Cancelled by renter before acceptance.");
              refreshWithToast(result);
            });
          }}
          title="Cancel this booking request?"
          trigger={
            <Button disabled={isPending} type="button" variant="outline">
              {isPending ? <Loader2 className="size-4 animate-spin" /> : null}
              Cancel Request
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
        {booking.payment_expires_at ? (
          <PaymentCountdown expiresAt={booking.payment_expires_at} />
        ) : (
          <p className="text-sm text-muted-foreground">Waiting for payment</p>
        )}
        <div className="flex flex-wrap justify-end gap-2">
          <PaymentButton
            bookingId={booking.id}
            paymentUrl={booking.hitpay_payment_url}
          />
          <ConfirmDialog
            confirmLabel="Cancel Booking"
            description="This will cancel the booking before payment is completed."
            onConfirm={async () => {
              startTransition(async () => {
                const result = await cancelBooking(booking.id, "Cancelled before payment.");
                refreshWithToast(result);
              });
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
      </div>
    );
  }

  if (booking.status === "confirmed") {
    return (
      <div className="space-y-3 text-right">
        <p className="text-sm text-muted-foreground">
          {booking.fulfillment_type === "pickup"
            ? `Pickup scheduled: ${booking.pickup_scheduled_at ? formatDateTime(booking.pickup_scheduled_at) : "To be confirmed"}`
            : `Delivery scheduled: ${booking.delivery_scheduled_at ? formatDateTime(booking.delivery_scheduled_at) : "To be confirmed"}`}
        </p>
        <ConfirmDialog
          confirmLabel="Cancel Booking"
          description="Cancelling now may affect your deposit depending on the listing policy."
          onConfirm={async () => {
            startTransition(async () => {
              const result = await cancelBooking(booking.id, "Cancelled after confirmation.");
              refreshWithToast(result);
            });
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

  if (booking.status === "out_for_delivery") {
    return (
      <div className="space-y-2 text-right">
        <p className="inline-flex items-center justify-end gap-2 text-sm font-medium text-primary">
          <Truck className="size-4" />
          Item is on its way!
        </p>
        <p className="text-sm text-muted-foreground">
          Delivery scheduled for {booking.delivery_scheduled_at ? formatDateTime(booking.delivery_scheduled_at) : "soon"}.
        </p>
      </div>
    );
  }

  if (booking.status === "active") {
    return (
      <div className="space-y-3 text-right">
        <p className="text-sm text-muted-foreground">
          Return by: {formatDateTime(booking.end_date)}
        </p>
        <div className="flex flex-wrap justify-end gap-2">
          <ReturnForm booking={booking} />

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
                  Tell us what went wrong and we&apos;ll help resolve it.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-2">
                <Label htmlFor={`renter-dispute-${booking.id}`}>Reason</Label>
                <Textarea
                  id={`renter-dispute-${booking.id}`}
                  onChange={(event) => setDisputeReason(event.target.value)}
                  rows={4}
                  value={disputeReason}
                />
              </div>
              <DialogFooter>
                <Button
                  disabled={isPending || disputeReason.trim().length < 5}
                  onClick={() => {
                    startTransition(async () => {
                      const result = await raiseDispute(booking.id, disputeReason);
                      refreshWithToast(result);
                    });
                  }}
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
    return (
      <p className="max-w-xs text-right text-sm text-muted-foreground">
        Item returned - waiting for lister to confirm condition.
      </p>
    );
  }

  if (booking.status === "completed") {
    return (
      <div className="space-y-3 text-right">
        <div className="text-sm text-muted-foreground">
          <p>Return condition: {booking.return_condition?.replaceAll("_", " ") ?? "Not recorded"}</p>
          <p>
            Deposit status: {booking.deposit_returned ? "Returned" : booking.return_condition === "damaged" || booking.return_condition === "missing_parts" ? "Partially held or under review" : "Processing"}
          </p>
        </div>
        {!booking.renter_reviewed ? (
          <DualReviewForm
            booking={booking}
            currentUserId={booking.renter_id}
            trigger={
              <Button type="button" variant="outline">
                <Star className="size-4" />
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
