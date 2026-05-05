import { redirect } from "next/navigation";
import Link from "next/link";

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

export default async function ListerReviewsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [reviews, writtenReviews, pendingReviews] = await Promise.all([
    getReviewsForUser(user.id, "as_renter"),
    getMyWrittenReviews(user.id),
    getPendingReviews(user.id),
  ]);
  const pendingAsLister = pendingReviews.filter((booking) => booking.lister_id === user.id);

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Lister Reviews</h1>
        <p className="text-sm text-muted-foreground">
          Reviews renters have left about you as a lister.
        </p>
      </div>

      {pendingAsLister.length > 0 ? (
        <div className="space-y-4 rounded-3xl border border-amber-200 bg-amber-50 p-5">
          <div className="space-y-1">
            <p className="font-semibold text-amber-950">
              You have {pendingAsLister.length} booking
              {pendingAsLister.length === 1 ? "" : "s"} to review
            </p>
            <p className="text-sm text-amber-900/80">
              Leave reviews for the renters who completed bookings with you.
            </p>
          </div>
          <div className="space-y-3">
            {pendingAsLister.map((booking) => (
              <div
                className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-white p-4 md:flex-row md:items-center md:justify-between"
                key={booking.id}
              >
                <div className="space-y-1">
                  <p className="font-medium text-foreground">{booking.listing.title}</p>
                  <p className="text-sm text-muted-foreground">
                    Review renter: {booking.renter.display_name || booking.renter.full_name}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <DualReviewForm
                    booking={booking}
                    currentUserId={user.id}
                    trigger={(
                      <Button className="bg-amber-950 text-white hover:bg-amber-900" type="button">
                        Leave Review
                      </Button>
                    )}
                  />
                  <Button asChild type="button" variant="outline">
                    <Link href="/lister/bookings">Open Bookings</Link>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <Tabs className="space-y-6" defaultValue="received">
        <TabsList>
          <TabsTrigger value="received">Received as Lister</TabsTrigger>
          <TabsTrigger value="written">My Reviews</TabsTrigger>
        </TabsList>

        <TabsContent value="received">
          <ReviewList canRespond currentUserId={user.id} reviews={reviews.data} showSummary />
        </TabsContent>
        <TabsContent value="written">
          <ReviewList reviews={writtenReviews} showSummary />
        </TabsContent>
      </Tabs>
    </div>
  );
}
