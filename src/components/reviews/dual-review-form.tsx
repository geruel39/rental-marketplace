"use client";

import {
  startTransition,
  useActionState,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Loader2, Star } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

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
import type { ActionResponse, BookingWithDetails } from "@/types";

interface DualReviewFormProps {
  booking: BookingWithDetails;
  currentUserId: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: React.ReactNode | null;
}

const initialState: ActionResponse | null = null;

function getReviewConfig(booking: BookingWithDetails, currentUserId: string) {
  const isRenter = booking.renter_id === currentUserId;

  if (isRenter) {
    return {
      heading: `Review your experience with ${
        booking.lister.display_name || booking.lister.full_name
      }`,
      description: "Share how the listing matched the description and how the host handled the rental.",
      subRatings: [
        { key: "accuracy_rating", label: "Accuracy" },
        { key: "condition_rating", label: "Condition" },
        { key: "communication_rating", label: "Communication" },
        { key: "value_rating", label: "Value" },
      ] as const,
    };
  }

  return {
    heading: `Review ${
      booking.renter.display_name || booking.renter.full_name
    } as a renter`,
    description: "Rate how they communicated, cared for the item, and handled pickup or return timing.",
    subRatings: [
      { key: "condition_rating", label: "Item Care" },
      { key: "communication_rating", label: "Communication" },
      { key: "accuracy_rating", label: "Punctuality" },
    ] as const,
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
  const [comment, setComment] = useState("");
  const [subRatings, setSubRatings] = useState<Record<string, number>>({});
  const open = openProp ?? internalOpen;
  const reviewConfig = useMemo(
    () => getReviewConfig(booking, currentUserId),
    [booking, currentUserId],
  );

  const setOpen = useCallback(
    (nextOpen: boolean) => {
      if (openProp === undefined) {
        setInternalOpen(nextOpen);
      }

      onOpenChange?.(nextOpen);
    },
    [onOpenChange, openProp],
  );

  useEffect(() => {
    if (!state?.success) {
      return;
    }

    toast.success(state.success);
    const timeoutId = window.setTimeout(() => {
      router.refresh();
      setOpen(false);
      setOverallRating(0);
      setComment("");
      setSubRatings({});
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [router, setOpen, state?.success]);

  useEffect(() => {
    if (!state?.error) {
      return;
    }

    toast.error(state.error);
  }, [state?.error]);

  const clientError =
    overallRating < 1 ? "Overall rating is required." : null;

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (clientError) {
      toast.error(clientError);
      return;
    }

    const formData = new FormData(event.currentTarget);
    startTransition(() => {
      formAction(formData);
    });
  }

  const formBody = (
    <form className="space-y-5" onSubmit={handleSubmit}>
      <input name="booking_id" type="hidden" value={booking.id} />
      <input name="overall_rating" type="hidden" value={overallRating} />

      {Object.entries(subRatings).map(([key, value]) => (
        <input key={key} name={key} type="hidden" value={value} />
      ))}

      <div className="rounded-2xl border border-border/70 bg-muted/30 p-4 text-sm">
        <p className="font-medium text-foreground">{booking.listing.title}</p>
        <p className="mt-1 text-muted-foreground">
          {booking.start_date} to {booking.end_date}
        </p>
      </div>

      {state?.error ? (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="space-y-2">
        <Label className="flex items-center gap-2">
          <Star className="size-4 text-amber-500" />
          Overall rating
        </Label>
        <StarRating onChange={setOverallRating} size="lg" value={overallRating} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {reviewConfig.subRatings.map((rating) => (
          <div key={rating.key} className="space-y-2 rounded-2xl border border-border/70 p-4">
            <Label>{rating.label}</Label>
            <StarRating
              onChange={(value) =>
                setSubRatings((current) => ({ ...current, [rating.key]: value }))
              }
              value={subRatings[rating.key] ?? 0}
            />
          </div>
        ))}
      </div>

      <div className="space-y-2">
        <Label htmlFor={`review-comment-${booking.id}`}>Comment</Label>
        <Textarea
          id={`review-comment-${booking.id}`}
          maxLength={2000}
          name="comment"
          onChange={(event) => setComment(event.target.value)}
          placeholder="Share any details that would help future renters or hosts."
          rows={5}
          value={comment}
        />
      </div>

      {clientError ? (
        <p className="text-sm text-destructive">{clientError}</p>
      ) : null}

      <DialogFooter>
        <Button disabled={isPending} type="submit">
          {isPending ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Sending...
            </>
          ) : (
            "Submit Review"
          )}
        </Button>
      </DialogFooter>
    </form>
  );

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
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{reviewConfig.heading}</DialogTitle>
          <DialogDescription>{reviewConfig.description}</DialogDescription>
        </DialogHeader>
        {formBody}
      </DialogContent>
    </Dialog>
  );
}
