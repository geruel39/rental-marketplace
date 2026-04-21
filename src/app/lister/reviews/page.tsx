import { redirect } from "next/navigation";

import { getReviewsForUser } from "@/actions/reviews";
import { ReviewList } from "@/components/reviews/review-list";
import { createClient } from "@/lib/supabase/server";

export default async function ListerReviewsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const reviews = await getReviewsForUser(user.id, "as_renter");

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Lister Reviews</h1>
        <p className="text-sm text-muted-foreground">
          Reviews renters have left about you as a lister.
        </p>
      </div>
      <ReviewList canRespond currentUserId={user.id} reviews={reviews.data} showSummary />
    </div>
  );
}
