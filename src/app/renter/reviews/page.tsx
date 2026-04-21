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

export default async function RenterReviewsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [receivedAsRenter, writtenReviews, pendingReviews] = await Promise.all([
    getReviewsForUser(user.id, "as_lister"),
    getMyWrittenReviews(user.id),
    getPendingReviews(user.id),
  ]);
  const pendingAsRenter = pendingReviews.filter((booking) => booking.renter_id === user.id);

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Renter Reviews</h1>
        <p className="text-sm text-muted-foreground">
          Track reviews you&apos;ve received and the feedback you&apos;ve shared as a renter.
        </p>
      </div>

      {pendingAsRenter.length > 0 ? (
        <div className="space-y-4 rounded-3xl border border-amber-200 bg-amber-50 p-5">
          <div className="space-y-1">
            <p className="font-semibold text-amber-950">
              You have {pendingAsRenter.length} booking
              {pendingAsRenter.length === 1 ? "" : "s"} to review
            </p>
            <p className="text-sm text-amber-900/80">
              Leave reviews for the listers you&apos;ve rented from.
            </p>
          </div>
          <div className="space-y-3">
            {pendingAsRenter.map((booking) => (
              <div
                className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-white p-4 md:flex-row md:items-center md:justify-between"
                key={booking.id}
              >
                <div className="space-y-1">
                  <p className="font-medium text-foreground">{booking.listing.title}</p>
                  <p className="text-sm text-muted-foreground">
                    Review lister: {booking.lister.display_name || booking.lister.full_name}
                  </p>
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
                    <Link href="/renter/rentals">Open Rentals</Link>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <Tabs className="space-y-6" defaultValue="received">
        <TabsList>
          <TabsTrigger value="received">Received as Renter</TabsTrigger>
          <TabsTrigger value="written">My Reviews</TabsTrigger>
        </TabsList>

        <TabsContent value="received">
          <ReviewList canRespond currentUserId={user.id} reviews={receivedAsRenter.data} showSummary />
        </TabsContent>
        <TabsContent value="written">
          <ReviewList reviews={writtenReviews} showSummary />
        </TabsContent>
      </Tabs>
    </div>
  );
}
