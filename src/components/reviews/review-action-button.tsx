"use client";

import { Star } from "lucide-react";

import { DualReviewForm } from "@/components/reviews/dual-review-form";
import { Button } from "@/components/ui/button";
import type { BookingWithDetails } from "@/types";

interface ReviewActionButtonProps {
  booking: BookingWithDetails;
  currentUserId: string;
  fullWidth?: boolean;
  showIcon?: boolean;
  size?: "default" | "sm" | "lg";
}

export function ReviewActionButton({
  booking,
  currentUserId,
  fullWidth = false,
  showIcon = false,
  size = "sm",
}: ReviewActionButtonProps) {
  return (
    <DualReviewForm
      booking={booking}
      currentUserId={currentUserId}
      trigger={
        <Button className={fullWidth ? "w-full" : undefined} size={size} type="button" variant="outline">
          {showIcon ? <Star className="size-4" /> : null}
          Leave Review
        </Button>
      }
    />
  );
}
