"use client";

import Link from "next/link";
import { useTransition } from "react";
import { CreditCard, Loader2, Star } from "lucide-react";
import { toast } from "sonner";

import { cancelBooking } from "@/actions/bookings";
import { DualReviewForm } from "@/components/reviews/dual-review-form";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import type { BookingWithDetails } from "@/types";

interface RentalActionsProps {
  booking: BookingWithDetails;
}

export function RentalActions({ booking }: RentalActionsProps) {
  const [isPending, startTransition] = useTransition();

  if (booking.status === "pending") {
    return (
      <ConfirmDialog
        confirmLabel="Cancel Booking"
        description="This will cancel your booking request."
        onConfirm={async () => {
          startTransition(async () => {
            const result = await cancelBooking(
              booking.id,
              "Cancelled from the renter dashboard before confirmation",
            );

            if (result?.error) {
              toast.error(result.error);
              return;
            }

            toast.success(result.success ?? "Booking cancelled");
          });
        }}
        title="Cancel this booking request?"
        trigger={
          <Button disabled={isPending} type="button" variant="outline">
            {isPending ? <Loader2 className="size-4 animate-spin" /> : null}
            Cancel
          </Button>
        }
        variant="destructive"
      />
    );
  }

  if (booking.status === "confirmed") {
    return (
      <Button asChild>
        <Link href={booking.hitpay_payment_url ?? "#"} rel="noreferrer" target="_blank">
          <CreditCard className="size-4" />
          Pay Now
        </Link>
      </Button>
    );
  }

  if (booking.status === "completed" && !booking.renter_reviewed) {
    return (
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
    );
  }

  return null;
}
