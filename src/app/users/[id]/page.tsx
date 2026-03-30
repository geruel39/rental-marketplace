import type { Metadata } from "next";
import Link from "next/link";
import { Building2, MapPin, UserRound } from "lucide-react";
import { notFound } from "next/navigation";

import { getPublicProfile, getUserListings } from "@/actions/profile";
import { getReviewsForUser } from "@/actions/reviews";
import { ListingGrid } from "@/components/listings/listing-grid";
import { MessageProfileButton } from "@/components/profile/message-profile-button";
import { ReputationDisplay } from "@/components/profile/reputation-display";
import { TrustBadges } from "@/components/profile/trust-badges";
import { ReviewList } from "@/components/reviews/review-list";
import { ReportDialog } from "@/components/shared/report-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { createClient } from "@/lib/supabase/server";
import { getInitials } from "@/lib/utils";

type SearchParams = Record<string, string | string[] | undefined>;

function getSingleValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function getPage(value: string | undefined) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const publicProfile = await getPublicProfile(id);
  const name =
    publicProfile?.profile.display_name ||
    publicProfile?.profile.full_name ||
    "User";

  return {
    title: `${name} — RentHub`,
  };
}

export default async function PublicProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { id } = await params;
  const resolvedSearchParams = await searchParams;
  const listingsPage = getPage(getSingleValue(resolvedSearchParams.listingsPage));
  const listerReviewsPage = getPage(getSingleValue(resolvedSearchParams.listerReviewsPage));
  const renterReviewsPage = getPage(getSingleValue(resolvedSearchParams.renterReviewsPage));

  const publicProfile = await getPublicProfile(id);

  if (!publicProfile) {
    notFound();
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [userListings, listerReviews, renterReviews] = await Promise.all([
    getUserListings(id, listingsPage),
    getReviewsForUser(id, "as_renter", listerReviewsPage),
    getReviewsForUser(id, "as_lister", renterReviewsPage),
  ]);

  const { profile } = publicProfile;
  const displayName = profile.display_name || profile.full_name || profile.email;
  const isOwnProfile = user?.id === profile.id;

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="space-y-8">
        <section className="rounded-3xl border border-border/70 bg-card p-6 shadow-sm">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex min-w-0 gap-4">
              <Avatar className="size-24" size="lg">
                <AvatarImage alt={displayName} src={profile.avatar_url ?? undefined} />
                <AvatarFallback>{getInitials(displayName)}</AvatarFallback>
              </Avatar>

              <div className="min-w-0 space-y-3">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-3xl font-semibold tracking-tight">{displayName}</h1>
                    <Badge variant="secondary">
                      {profile.account_type === "business" ? "Business" : "Individual"}
                    </Badge>
                  </div>
                  {profile.account_type === "business" && profile.business_name ? (
                    <p className="text-sm text-muted-foreground">{profile.business_name}</p>
                  ) : null}
                  {profile.bio ? (
                    <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
                      {profile.bio}
                    </p>
                  ) : null}
                </div>

                <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                  {profile.location ? (
                    <span className="flex items-center gap-2">
                      <MapPin className="size-4" />
                      {profile.location}
                    </span>
                  ) : null}
                  <span className="flex items-center gap-2">
                    {profile.account_type === "business" ? (
                      <Building2 className="size-4" />
                    ) : (
                      <UserRound className="size-4" />
                    )}
                    {profile.account_type === "business" ? "Business account" : "Individual account"}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              {isOwnProfile ? (
                <Button asChild variant="outline">
                  <Link href="/dashboard/settings">Edit Profile</Link>
                </Button>
              ) : user ? (
                <>
                  <MessageProfileButton
                    currentUserId={user.id}
                    profileUserId={profile.id}
                  />
                  <ReportDialog targetId={profile.id} targetType="user" />
                </>
              ) : null}
            </div>
          </div>
        </section>

        <TrustBadges profile={profile} />

        <ReputationDisplay
          ratingAsLister={profile.rating_as_lister}
          ratingAsRenter={profile.rating_as_renter}
          totalReviewsAsLister={profile.total_reviews_as_lister}
          totalReviewsAsRenter={profile.total_reviews_as_renter}
        />

        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-3xl border border-border/70 bg-card p-5 shadow-sm">
            <p className="text-sm text-muted-foreground">Listings</p>
            <p className="mt-2 text-3xl font-semibold">{publicProfile.listingsCount}</p>
          </div>
          <div className="rounded-3xl border border-border/70 bg-card p-5 shadow-sm">
            <p className="text-sm text-muted-foreground">Rentals</p>
            <p className="mt-2 text-3xl font-semibold">{profile.total_rentals_completed}</p>
          </div>
          <div className="rounded-3xl border border-border/70 bg-card p-5 shadow-sm">
            <p className="text-sm text-muted-foreground">Response Rate</p>
            <p className="mt-2 text-3xl font-semibold">{profile.response_rate}%</p>
          </div>
        </div>

        <Tabs className="space-y-6" defaultValue="listings">
          <TabsList>
            <TabsTrigger value="listings">Listings</TabsTrigger>
            <TabsTrigger value="lister-reviews">Lister Reviews</TabsTrigger>
            <TabsTrigger value="renter-reviews">Renter Reviews</TabsTrigger>
          </TabsList>

          <TabsContent value="listings">
            <ListingGrid listings={userListings.data} />
          </TabsContent>

          <TabsContent value="lister-reviews">
            <ReviewList
              currentUserId={user?.id}
              enableReporting={Boolean(user)}
              reviews={listerReviews.data}
              showSummary
            />
          </TabsContent>

          <TabsContent value="renter-reviews">
            <ReviewList
              currentUserId={user?.id}
              enableReporting={Boolean(user)}
              reviews={renterReviews.data}
              showSummary
            />
          </TabsContent>
        </Tabs>
      </div>
    </main>
  );
}
