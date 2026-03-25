import { Star } from "lucide-react";
import { redirect } from "next/navigation";

import {
  getMyWrittenReviews,
  getPendingReviews,
  getReviewsForUser,
} from "@/actions/reviews";
import { DualReviewForm } from "@/components/reviews/dual-review-form";
import { ReviewList } from "@/components/reviews/review-list";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { createClient } from "@/lib/supabase/server";

export default async function ReviewsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [receivedAsLister, receivedAsRenter, writtenReviews, pendingReviews] =
    await Promise.all([
      getReviewsForUser(user.id, "as_renter"),
      getReviewsForUser(user.id, "as_lister"),
      getMyWrittenReviews(user.id),
      getPendingReviews(user.id),
    ]);

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Reviews</h1>
        <p className="text-sm text-muted-foreground">
          Manage reviews you have received, feedback you have written, and bookings that still need a review.
        </p>
      </div>

      {pendingReviews.length > 0 ? (
        <div className="space-y-4 rounded-3xl border border-amber-200 bg-amber-50 p-5">
          <div className="space-y-1">
            <p className="font-semibold text-amber-950">
              You have {pendingReviews.length} booking
              {pendingReviews.length === 1 ? "" : "s"} to review
            </p>
            <p className="text-sm text-amber-900/80">
              Leaving feedback helps build trust for future renters and listers.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {pendingReviews.map((booking) => (
              <DualReviewForm
                key={booking.id}
                booking={booking}
                currentUserId={user.id}
                trigger={
                  <button
                    className="inline-flex items-center gap-2 rounded-full border border-amber-300 bg-white px-4 py-2 text-sm font-medium text-amber-950 transition-colors hover:bg-amber-100"
                    type="button"
                  >
                    <Star className="size-4" />
                    Review {booking.listing.title}
                  </button>
                }
              />
            ))}
          </div>
        </div>
      ) : null}

      <Tabs className="space-y-6" defaultValue="lister">
        <TabsList>
          <TabsTrigger value="lister">Received as Lister</TabsTrigger>
          <TabsTrigger value="renter">Received as Renter</TabsTrigger>
          <TabsTrigger value="written">My Reviews</TabsTrigger>
        </TabsList>

        <TabsContent value="lister">
          <ReviewList
            canRespond
            currentUserId={user.id}
            reviews={receivedAsLister.data}
            showSummary
          />
        </TabsContent>

        <TabsContent value="renter">
          <ReviewList
            canRespond
            currentUserId={user.id}
            reviews={receivedAsRenter.data}
            showSummary
          />
        </TabsContent>

        <TabsContent value="written">
          <ReviewList reviews={writtenReviews} showSummary />
        </TabsContent>
      </Tabs>
    </div>
  );
}
