"use client";

import { startTransition, useActionState, useEffect, useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Star } from "lucide-react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { submitReview } from "@/actions/reviews";
import { StarRating } from "@/components/reviews/star-rating";
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
import { reviewSchema, type ReviewInput } from "@/lib/validations";
import type { ActionResponse, BookingWithDetails } from "@/types";

interface DualReviewFormProps {
  booking: BookingWithDetails;
  currentUserId: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: React.ReactNode | null;
}

const initialState: ActionResponse | null = null;
type ReviewFormValues = z.input<typeof reviewSchema>;

function getReviewCopy(booking: BookingWithDetails, currentUserId: string) {
  const isRenter = booking.renter_id === currentUserId;

  if (isRenter) {
    const listerName = booking.lister.display_name || booking.lister.full_name;

    return {
      title: `How was your experience with ${listerName}?`,
      description: "Your overall rating helps future renters know what to expect.",
      placeholder: "Was the item as described? How was the handover?",
      disclaimer: `Your review will be visible to ${listerName}.`,
    };
  }

  const renterName = booking.renter.display_name || booking.renter.full_name;

  return {
    title: `How was your experience with ${renterName}?`,
    description: "A quick overall review makes it easier to build trust on the marketplace.",
    placeholder: "Was the renter respectful of your item? Timely return?",
    disclaimer: `Your review will be visible to ${renterName}.`,
  };
}

export function DualReviewForm({
  booking,
  currentUserId,
  open: openProp,
  onOpenChange,
  trigger,
}: DualReviewFormProps) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(submitReview, initialState);
  const [internalOpen, setInternalOpen] = useState(false);
  const [overallRating, setOverallRating] = useState(0);
  const open = openProp ?? internalOpen;
  const copy = useMemo(
    () => getReviewCopy(booking, currentUserId),
    [booking, currentUserId],
  );

  const form = useForm<ReviewFormValues, unknown, ReviewInput>({
    resolver: zodResolver(reviewSchema),
    defaultValues: {
      booking_id: booking.id,
      overall_rating: 0,
      comment: "",
    },
  });

  function setOpen(nextOpen: boolean) {
    if (openProp === undefined) {
      setInternalOpen(nextOpen);
    }

    onOpenChange?.(nextOpen);
  }

  useEffect(() => {
    if (!state?.success) {
      return;
    }

    toast.success(state.success);
    router.refresh();
    setOpen(false);
    setOverallRating(0);
    form.reset({
      booking_id: booking.id,
      overall_rating: 0,
      comment: "",
    });
  }, [booking.id, form, router, state?.success]);

  useEffect(() => {
    if (!state?.error) {
      return;
    }

    toast.error(state.error);
  }, [state?.error]);

  function handleSubmit(values: ReviewInput) {
    if (values.overall_rating < 1) {
      toast.error("Overall rating is required.");
      return;
    }

    const formData = new FormData();
    formData.set("booking_id", values.booking_id);
    formData.set("overall_rating", String(values.overall_rating));

    if (values.comment?.trim()) {
      formData.set("comment", values.comment.trim());
    }

    startTransition(() => {
      formAction(formData);
    });
  }

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      {trigger === null ? null : (
        <DialogTrigger asChild>
          {trigger ?? (
            <Button type="button" variant="outline">
              <Star className="size-4" />
              Leave Review
            </Button>
          )}
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-xl">
        <DialogHeader className="space-y-2">
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription>{copy.description}</DialogDescription>
        </DialogHeader>

        <form
          className="space-y-6"
          onSubmit={form.handleSubmit(handleSubmit, () => {
            toast.error("Overall rating is required.");
          })}
        >
          <input type="hidden" {...form.register("booking_id")} value={booking.id} />

          {state?.error ? (
            <Alert variant="destructive">
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          ) : null}

          <div className="rounded-2xl border border-border/70 bg-muted/30 p-4 text-sm">
            <p className="font-medium text-foreground">{booking.listing.title}</p>
            <p className="mt-1 text-muted-foreground">
              {booking.start_date} to {booking.end_date}
            </p>
          </div>

          <div className="space-y-4 text-center">
            <div className="space-y-2">
              <Label className="justify-center text-base font-medium text-brand-navy">
                Overall Rating
              </Label>
              <div className="flex justify-center">
                <StarRating
                  onChange={(value) => {
                    setOverallRating(value);
                    form.setValue("overall_rating", value, {
                      shouldDirty: true,
                      shouldValidate: true,
                    });
                  }}
                  size="lg"
                  value={overallRating}
                />
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              {overallRating > 0
                ? `You selected ${overallRating} out of 5 stars.`
                : "Tap a star to rate your overall experience."}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor={`review-comment-${booking.id}`}>Comment</Label>
            <Textarea
              id={`review-comment-${booking.id}`}
              maxLength={2000}
              placeholder={copy.placeholder}
              rows={5}
              {...form.register("comment")}
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{copy.disclaimer}</span>
              <span>{form.watch("comment")?.length ?? 0}/2000</span>
            </div>
          </div>

          <DialogFooter>
            <Button
              className="w-full bg-brand-navy text-white hover:bg-brand-steel sm:w-auto"
              disabled={isPending}
              type="submit"
            >
              {isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                "Submit Review"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
