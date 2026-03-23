import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatRelativeTime, getInitials } from "@/lib/utils";
import { StarRating } from "@/components/reviews/star-rating";
import type { ReviewWithUsers } from "@/types";

interface ReviewCardProps {
  review: ReviewWithUsers;
}

export function ReviewCard({ review }: ReviewCardProps) {
  const reviewerName =
    review.reviewer.display_name || review.reviewer.full_name || review.reviewer.email;
  const revieweeName =
    review.reviewee.display_name || review.reviewee.full_name || review.reviewee.email;

  return (
    <article className="rounded-3xl border border-border/70 bg-card p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <Avatar size="lg">
            <AvatarImage alt={reviewerName} src={review.reviewer.avatar_url ?? undefined} />
            <AvatarFallback>{getInitials(reviewerName)}</AvatarFallback>
          </Avatar>
          <div className="space-y-2">
            <div>
              <p className="font-medium">{reviewerName}</p>
              <p className="text-sm text-muted-foreground">
                {formatRelativeTime(review.created_at)}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <StarRating readOnly size="sm" value={review.overall_rating} />
              <Badge variant="secondary">
                {review.review_role === "as_renter"
                  ? "Reviewed as Renter"
                  : "Reviewed as Lister"}
              </Badge>
            </div>
          </div>
        </div>
      </div>

      {review.comment ? (
        <p className="mt-4 text-sm leading-6 text-muted-foreground">{review.comment}</p>
      ) : null}

      {review.response ? (
        <div className="mt-4 rounded-2xl bg-muted/40 p-4 text-sm text-muted-foreground">
          <p className="mb-1 font-medium text-foreground">{revieweeName} responded</p>
          <p>{review.response}</p>
        </div>
      ) : null}
    </article>
  );
}
