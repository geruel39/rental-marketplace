import Link from "next/link";
import { MapPin, Star, Truck } from "lucide-react";
import { notFound } from "next/navigation";

import { checkFavorites } from "@/actions/favorites";
import { getListingWithDetails } from "@/actions/listings";
import { getReviewsForListing } from "@/actions/reviews";
import { BookingWidget } from "@/components/listings/booking-widget";
import { FavoriteButton } from "@/components/listings/favorite-button";
import { ImageGallery } from "@/components/listings/image-gallery";
import { ListingGrid } from "@/components/listings/listing-grid";
import { StockLevelBadge } from "@/components/inventory/stock-level-badge";
import { ProfileCard } from "@/components/profile/profile-card";
import { ReviewCard } from "@/components/reviews/review-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency } from "@/lib/utils";

interface ListingDetailPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ListingDetailPage({
  params,
  searchParams,
}: ListingDetailPageProps) {
  const { id } = await params;
  const resolvedSearchParams = await searchParams;
  const data = await getListingWithDetails(id);

  if (!data) {
    notFound();
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: category } = data.listing.category_id
    ? await supabase
        .from("categories")
        .select("name")
        .eq("id", data.listing.category_id)
        .maybeSingle<{ name: string }>()
    : { data: null };

  const isLoggedIn = Boolean(user);
  const isOwner = user?.id === data.listing.owner_id;
  const isFavorited = user
    ? (await checkFavorites([data.listing.id], user.id)).has(data.listing.id)
    : false;
  const showAllReviews =
    (Array.isArray(resolvedSearchParams.reviews)
      ? resolvedSearchParams.reviews[0]
      : resolvedSearchParams.reviews) === "all";
  const listingReviews = await getReviewsForListing(id, 1);
  const reviewCount = listingReviews.totalCount;
  const averageRating =
    data.reviews.length > 0
      ? data.reviews.reduce((sum, review) => sum + review.overall_rating, 0) /
        data.reviews.length
      : 0;
  const location = [
    data.listing.city,
    data.listing.state,
    data.listing.location,
  ]
    .filter(Boolean)
    .join(", ");
  const detailItems = [
    { label: "Brand", value: data.listing.brand },
    { label: "Model", value: data.listing.model },
    { label: "Condition", value: data.listing.condition },
    {
      label: "Year",
      value: data.listing.year ? String(data.listing.year) : null,
    },
  ].filter((item) => item.value);
  const pricingRows = [
    { label: "Hourly", value: data.listing.price_per_hour },
    { label: "Daily", value: data.listing.price_per_day },
    { label: "Weekly", value: data.listing.price_per_week },
    { label: "Monthly", value: data.listing.price_per_month },
  ].filter((row) => typeof row.value === "number");
  const displayedReviews = showAllReviews
    ? listingReviews.data
    : listingReviews.data.slice(0, 5);

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)] lg:items-start">
        <div className="space-y-8">
          <ImageGallery images={data.listing.images} />

          <section className="space-y-4" id="reviews">
            <div className="flex flex-wrap items-center gap-2">
              {category?.name ? <Badge variant="secondary">{category.name}</Badge> : null}
              <Badge variant={data.listing.status === "active" ? "default" : "secondary"}>
                {data.listing.status}
              </Badge>
            </div>

            <div className="space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-2">
                  <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                    {data.listing.title}
                  </h1>
                  <p className="text-sm text-muted-foreground">
                    {data.listing.favorites_count}{" "}
                    {data.listing.favorites_count === 1 ? "person" : "people"} saved this
                  </p>
                </div>
                <FavoriteButton
                  className="shrink-0"
                  currentUserId={user?.id}
                  isFavorited={isFavorited}
                  listingId={data.listing.id}
                  refreshOnSuccess
                  size="sm"
                  variant="outline"
                />
              </div>
              <div className="flex flex-wrap items-center gap-3 text-muted-foreground">
                <span className="flex items-center gap-2">
                  <MapPin className="size-4" />
                  {location || "Location not specified"}
                </span>
                <StockLevelBadge
                  lowStockThreshold={data.listing.low_stock_threshold}
                  quantityAvailable={data.listing.quantity_available}
                  size="md"
                  trackInventory={data.listing.track_inventory}
                />
              </div>
            </div>
          </section>

          <Separator />

          <section className="space-y-3">
            <h2 className="text-xl font-semibold">Description</h2>
            <p className="leading-7 text-muted-foreground">{data.listing.description}</p>
          </section>

          {detailItems.length > 0 ? (
            <section className="space-y-4">
              <h2 className="text-xl font-semibold">Item Details</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {detailItems.map((item) => (
                  <div
                    key={item.label}
                    className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm"
                  >
                    <p className="text-sm font-medium text-muted-foreground">{item.label}</p>
                    <p className="mt-1 font-medium">{item.value}</p>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {data.listing.delivery_available ? (
            <section className="space-y-4">
              <h2 className="text-xl font-semibold">Delivery</h2>
              <div className="rounded-3xl border border-border/70 bg-card p-5 shadow-sm">
                <p className="flex items-center gap-2 font-medium">
                  <Truck className="size-4 text-primary" />
                  Delivery available
                </p>
                <div className="mt-3 grid gap-3 text-sm text-muted-foreground sm:grid-cols-2">
                  <p>Fee: {formatCurrency(data.listing.delivery_fee)}</p>
                  <p>
                    Radius:{" "}
                    {data.listing.delivery_radius_km
                      ? `${data.listing.delivery_radius_km} km`
                      : "Not specified"}
                  </p>
                </div>
              </div>
            </section>
          ) : null}

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">Rules & Policies</h2>
            <div className="rounded-3xl border border-border/70 bg-card p-5 shadow-sm">
              {data.listing.rules ? (
                <p className="mb-4 leading-7 text-muted-foreground">{data.listing.rules}</p>
              ) : (
                <p className="mb-4 text-muted-foreground">No special rules listed.</p>
              )}
              <div className="flex flex-wrap gap-3 text-sm">
                <Badge variant="outline">
                  Cancellation: {data.listing.cancellation_policy}
                </Badge>
                <Badge variant="outline">
                  Minimum rental: {data.listing.minimum_rental_period}{" "}
                  {data.listing.primary_pricing_period}
                  {data.listing.minimum_rental_period === 1 ? "" : "s"}
                </Badge>
              </div>
            </div>
          </section>

          <Separator />

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">Lister</h2>
            <ProfileCard compact profile={data.owner} />
          </section>

          <Separator />

          <section className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-xl font-semibold">Reviews</h2>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Star className="size-4 fill-current text-amber-500" />
                <span>
                  {reviewCount > 0 ? averageRating.toFixed(1) : "No rating yet"}
                </span>
                <span>({reviewCount})</span>
              </div>
            </div>

            {reviewCount === 0 ? (
              <div className="rounded-3xl border border-dashed border-border bg-muted/20 px-6 py-10 text-center text-muted-foreground">
                No reviews yet
              </div>
            ) : (
              <div className="space-y-4">
                {displayedReviews.map((review) => (
                  <ReviewCard key={review.id} review={review} />
                ))}
                {listingReviews.totalCount > 5 && !showAllReviews ? (
                  <Button asChild variant="outline">
                    <Link href={`/listings/${id}?reviews=all#reviews`}>
                      View All Reviews
                    </Link>
                  </Button>
                ) : null}
              </div>
            )}
          </section>

          {data.similarListings.length > 0 ? (
            <section className="space-y-4">
              <h2 className="text-xl font-semibold">Similar Items</h2>
              <ListingGrid listings={data.similarListings} />
            </section>
          ) : null}
        </div>

        <aside className="lg:min-w-0">
          <BookingWidget
            currentUserId={user?.id}
            isLoggedIn={isLoggedIn}
            isOwner={isOwner}
            listing={data.listing}
          />

          {pricingRows.length > 1 ? (
            <div className="mt-4 rounded-3xl border border-border/70 bg-card p-5 shadow-sm">
              <h3 className="mb-3 font-semibold">More Pricing</h3>
              <div className="space-y-2 text-sm text-muted-foreground">
                {pricingRows.map((row) => (
                  <div key={row.label} className="flex items-center justify-between gap-3">
                    <span>{row.label}</span>
                    <span className="font-medium text-foreground">
                      {formatCurrency(row.value ?? 0)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </aside>
      </div>
    </main>
  );
}
