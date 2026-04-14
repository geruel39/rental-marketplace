import Link from "next/link";
import { redirect } from "next/navigation";

import {
  getMyWrittenReviews,
  getPendingReviews,
  getReviewsForUser,
} from "@/actions/reviews";
import { DualReviewForm } from "@/components/reviews/dual-review-form";
import { ReviewList } from "@/components/reviews/review-list";
import { Button } from "@/components/ui/button";
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
  const pendingAsRenter = pendingReviews.filter((booking) => booking.renter_id === user.id);
  const pendingAsLister = pendingReviews.filter((booking) => booking.lister_id === user.id);

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
              Leave your pending reviews directly from here.
            </p>
          </div>
          <div className="space-y-3">
            {pendingReviews.map((booking) => {
              const isRenter = booking.renter_id === user.id;
              const otherPartyName = isRenter
                ? booking.lister.display_name || booking.lister.full_name
                : booking.renter.display_name || booking.renter.full_name;

              return (
                <div
                  className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-white p-4 md:flex-row md:items-center md:justify-between"
                  key={booking.id}
                >
                  <div className="space-y-1">
                    <p className="font-medium text-foreground">{booking.listing.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {isRenter ? "Review lister" : "Review renter"}: {otherPartyName}
                    </p>
                    <p className="text-xs text-muted-foreground">Booking #{booking.id.slice(0, 8)}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <DualReviewForm
                      booking={booking}
                      currentUserId={user.id}
                      trigger={
                        <Button className="bg-amber-950 text-white hover:bg-amber-900" type="button">
                          Leave Review
                        </Button>
                      }
                    />
                    <Button asChild type="button" variant="outline">
                      <Link href={isRenter ? "/dashboard/my-rentals" : "/dashboard/requests"}>
                        Open Booking List
                      </Link>
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      <Tabs className="space-y-6" defaultValue="lister">
        <TabsList>
          <TabsTrigger value="lister">Received as Lister</TabsTrigger>
          <TabsTrigger value="renter">Received as Renter</TabsTrigger>
          <TabsTrigger value="my-reviews">My Reviews</TabsTrigger>
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

        <TabsContent value="my-reviews">
          <ReviewList reviews={writtenReviews} showSummary />
        </TabsContent>
      </Tabs>
    </div>
  );
}
