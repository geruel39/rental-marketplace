"use client";

import { Star } from "lucide-react";

import { DualReviewForm } from "@/components/reviews/dual-review-form";
import { Button } from "@/components/ui/button";
import type { BookingWithDetails } from "@/types";

interface ReviewActionButtonProps {
  booking: BookingWithDetails;
  currentUserId: string;
  buttonClassName?: string;
  fullWidth?: boolean;
  showIcon?: boolean;
  size?: "default" | "sm" | "lg";
}

export function ReviewActionButton({
  booking,
  buttonClassName,
  currentUserId,
  fullWidth = false,
  showIcon = true,
  size = "sm",
}: ReviewActionButtonProps) {
  return (
    <DualReviewForm
      booking={booking}
      currentUserId={currentUserId}
      trigger={
        <Button
          className={[
            "bg-amber-500 text-slate-950 hover:bg-amber-400 [&_svg]:text-slate-950",
            fullWidth ? "w-full" : "",
            buttonClassName ?? "",
          ].filter(Boolean).join(" ")}
          size={size}
          type="button"
        >
          {showIcon ? <Star className="size-4" /> : null}
          Leave Review
        </Button>
      }
    />
  );
}
