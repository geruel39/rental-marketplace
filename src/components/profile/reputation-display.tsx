import { StarRating } from "@/components/reviews/star-rating";

interface ReputationDisplayProps {
  ratingAsLister: number;
  totalReviewsAsLister: number;
  ratingAsRenter: number;
  totalReviewsAsRenter: number;
}

function ReputationCard({
  title,
  rating,
  count,
}: {
  title: string;
  rating: number;
  count: number;
}) {
  return (
    <div className="rounded-3xl border border-border/70 bg-card p-5 shadow-sm">
      <p className="text-brand-steel text-sm font-medium">{title}</p>
      {count > 0 ? (
        <div className="mt-3 space-y-2">
          <div className="flex items-center gap-3">
            <span className="text-brand-navy text-3xl font-bold">{rating.toFixed(1)}</span>
            <StarRating readOnly size="sm" value={rating} />
          </div>
          <p className="text-sm text-muted-foreground">
            {count} review{count === 1 ? "" : "s"}
          </p>
        </div>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">No reviews yet</p>
      )}
    </div>
  );
}

export function ReputationDisplay({
  ratingAsLister,
  totalReviewsAsLister,
  ratingAsRenter,
  totalReviewsAsRenter,
}: ReputationDisplayProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <ReputationCard
        count={totalReviewsAsLister}
        rating={ratingAsLister}
        title="As Lister"
      />
      <ReputationCard
        count={totalReviewsAsRenter}
        rating={ratingAsRenter}
        title="As Renter"
      />
    </div>
  );
}
