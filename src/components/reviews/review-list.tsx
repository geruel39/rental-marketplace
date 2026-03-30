"use client";

import { useMemo, useState, useTransition } from "react";
import { MessageSquareReply } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { respondToReview } from "@/actions/reviews";
import { ReviewCard } from "@/components/reviews/review-card";
import { EmptyState } from "@/components/shared/empty-state";
import { Pagination } from "@/components/shared/pagination";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import type { ReviewWithUsers } from "@/types";

interface ReviewListProps {
  reviews: ReviewWithUsers[];
  showSummary?: boolean;
  currentUserId?: string;
  canRespond?: boolean;
  currentPage?: number;
  totalPages?: number;
  enableReporting?: boolean;
}

export function ReviewList({
  reviews,
  showSummary = false,
  currentUserId,
  canRespond = false,
  currentPage,
  totalPages,
  enableReporting = false,
}: ReviewListProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [activeResponseId, setActiveResponseId] = useState<string | null>(null);
  const [responseText, setResponseText] = useState("");

  const summary = useMemo(() => {
    if (reviews.length === 0) {
      return null;
    }

    const distribution = [5, 4, 3, 2, 1].map((rating) => {
      const count = reviews.filter((review) => review.overall_rating === rating).length;
      return {
        rating,
        count,
        percentage: (count / reviews.length) * 100,
      };
    });

    return {
      average:
        reviews.reduce((sum, review) => sum + review.overall_rating, 0) / reviews.length,
      total: reviews.length,
      distribution,
    };
  }, [reviews]);

  if (reviews.length === 0) {
    return (
      <EmptyState
        description="Reviews will appear here once bookings are completed and feedback is submitted."
        icon={MessageSquareReply}
        title="No reviews yet"
      />
    );
  }

  function handleResponseSubmit(reviewId: string) {
    const trimmed = responseText.trim();

    if (trimmed.length < 3) {
      toast.error("Response must be at least 3 characters.");
      return;
    }

    startTransition(async () => {
      const result = await respondToReview(reviewId, trimmed);

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success(result.success ?? "Response added");
      setActiveResponseId(null);
      setResponseText("");
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      {showSummary && summary ? (
        <div className="grid gap-6 rounded-3xl border border-border bg-background p-6 shadow-sm lg:grid-cols-[220px_1fr]">
          <div className="space-y-2">
            <p className="text-4xl font-semibold">{summary.average.toFixed(1)}</p>
            <p className="text-sm text-muted-foreground">
              {summary.total} review{summary.total === 1 ? "" : "s"}
            </p>
          </div>

          <div className="space-y-3">
            {summary.distribution.map((item) => (
              <div key={item.rating} className="grid grid-cols-[56px_1fr_48px] items-center gap-3 text-sm">
                <span>{item.rating} star</span>
                <Progress value={item.percentage} />
                <span className="text-right text-muted-foreground">
                  {Math.round(item.percentage)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="space-y-4">
        {reviews.map((review) => {
          const canRespondToReview =
            canRespond &&
            currentUserId === review.reviewee_id &&
            !review.response;

          return (
            <div key={review.id} className="space-y-3">
              <ReviewCard
                canReport={enableReporting && currentUserId !== review.reviewer_id}
                review={review}
              />

              {canRespondToReview ? (
                <div className="rounded-2xl border border-border/70 bg-background p-4 shadow-sm">
                  {activeResponseId === review.id ? (
                    <div className="space-y-3">
                      <div className="space-y-2">
                        <Label htmlFor={`response-${review.id}`}>Respond to this review</Label>
                        <Textarea
                          id={`response-${review.id}`}
                          onChange={(event) => setResponseText(event.target.value)}
                          placeholder="Share a polite public response."
                          rows={4}
                          value={responseText}
                        />
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          disabled={isPending}
                          onClick={() => handleResponseSubmit(review.id)}
                          type="button"
                        >
                          Save Response
                        </Button>
                        <Button
                          onClick={() => {
                            setActiveResponseId(null);
                            setResponseText("");
                          }}
                          type="button"
                          variant="outline"
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button
                      onClick={() => setActiveResponseId(review.id)}
                      type="button"
                      variant="outline"
                    >
                      Respond
                    </Button>
                  )}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      {currentPage && totalPages ? (
        <Pagination currentPage={currentPage} totalPages={totalPages} />
      ) : null}
    </div>
  );
}
