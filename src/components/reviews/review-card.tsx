import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ReportDialog } from "@/components/shared/report-dialog";
import { formatRelativeTime, getInitials } from "@/lib/utils";
import { StarRating } from "@/components/reviews/star-rating";
import type { ReviewWithUsers } from "@/types";

interface ReviewCardProps {
  review: ReviewWithUsers;
  canReport?: boolean;
}

export function ReviewCard({ review, canReport = false }: ReviewCardProps) {
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
              <Badge variant="secondary">
                {review.review_role === "as_renter"
                  ? "Reviewed as Renter"
                  : "Reviewed as Lister"}
              </Badge>
              <p className="mt-1 text-sm text-muted-foreground">
                {formatRelativeTime(review.created_at)}
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <div className="text-right">
            <p className="text-lg font-semibold text-brand-navy">
              {review.overall_rating.toFixed(1)}
            </p>
            <StarRating readOnly size="md" value={review.overall_rating} />
          </div>
        {canReport ? (
          <ReportDialog
            targetId={review.id}
            targetType="review"
            trigger={<Badge variant="outline">Report</Badge>}
          />
        ) : null}
        </div>
      </div>

      {review.comment ? (
        <p className="mt-4 text-sm leading-6 text-muted-foreground">{review.comment}</p>
      ) : null}

      {review.response ? (
        <div className="mt-4 ml-4 rounded-2xl border border-brand-navy/10 bg-muted/40 p-4 text-sm text-muted-foreground">
          <p className="mb-1 font-medium text-foreground">{revieweeName} responded</p>
          {review.responded_at ? (
            <p className="mb-2 text-xs text-muted-foreground">
              {formatRelativeTime(review.responded_at)}
            </p>
          ) : null}
          <p>{review.response}</p>
        </div>
      ) : null}
    </article>
  );
}
