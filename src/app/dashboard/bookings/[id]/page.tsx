import { format } from "date-fns";
import { Star } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { getBookingDetails, getBookingTimeline } from "@/actions/bookings";
import { BookingStatusBadge } from "@/components/bookings/booking-status-badge";
import { PaymentButton } from "@/components/bookings/payment-button";
import { BookingTimeline } from "@/components/bookings/booking-timeline";
import { PaymentCountdown } from "@/components/bookings/payment-countdown";
import { RequestActions } from "@/components/bookings/request-actions";
import { RentalActions } from "@/components/bookings/rental-actions";
import { MessageProfileButton } from "@/components/profile/message-profile-button";
import { TrustBadges } from "@/components/profile/trust-badges";
import { ReviewCard } from "@/components/reviews/review-card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency } from "@/lib/utils";
import type { ReviewWithUsers } from "@/types";

interface BookingDetailPageProps {
  params: Promise<{ id: string }>;
}

function formatDateRange(start: string, end: string) {
  return `${format(new Date(start), "PPP")} -> ${format(new Date(end), "PPP")}`;
}

function formatDateTime(value?: string | null) {
  if (!value) {
    return "Not available";
  }

  return format(new Date(value), "PPP p");
}

function paymentTone(status?: string | null) {
  switch (status) {
    case "completed":
      return "bg-emerald-100 text-emerald-700";
    case "expired":
    case "failed":
      return "bg-red-100 text-red-700";
    default:
      return "bg-slate-100 text-slate-700";
  }
}

export default async function BookingDetailPage({
  params,
}: BookingDetailPageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle<{ is_admin: boolean }>();

  const booking = await getBookingDetails(id);
  const timeline = await getBookingTimeline(id);

  if (!booking) {
    redirect("/dashboard");
  }

  const isAdmin = profile?.is_admin ?? false;
  const isLister = booking.lister_id === user.id;
  const isRenter = booking.renter_id === user.id;

  if (!isAdmin && !isLister && !isRenter) {
    redirect("/dashboard");
  }

  const { data: reviews } = await supabase
    .from("reviews")
    .select(
      `
        *,
        reviewer:profiles!reviews_reviewer_id_fkey(*),
        reviewee:profiles!reviews_reviewee_id_fkey(*)
      `,
    )
    .eq("booking_id", booking.id);

  const reviewItems = (reviews ?? []) as ReviewWithUsers[];
  const otherParty = isLister ? booking.renter : booking.lister;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 rounded-3xl border border-border/70 bg-background p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">
              Booking #{booking.id.slice(0, 8)}
            </h1>
            <BookingStatusBadge status={booking.status} />
            <Badge variant="outline">
              {booking.fulfillment_type === "delivery" ? "🚚 Delivery" : "📦 Pickup"}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Created {formatDateTime(booking.created_at)}
          </p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <section className="rounded-3xl border border-border/70 bg-background p-5 shadow-sm">
            <h2 className="text-lg font-semibold">Listing Info</h2>
            <div className="mt-4 flex gap-4">
              <div className="size-24 overflow-hidden rounded-2xl bg-muted">
                {booking.listing.images[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    alt={booking.listing.title}
                    className="h-full w-full object-cover"
                    src={booking.listing.images[0]}
                  />
                ) : null}
              </div>
              <div className="space-y-2">
                <Link
                  className="text-lg font-medium transition-colors hover:text-primary hover:underline"
                  href={`/listings/${booking.listing.id}`}
                >
                  {booking.listing.title}
                </Link>
                <p className="text-sm text-muted-foreground">
                  {formatCurrency(
                    booking.listing[
                      `price_per_${booking.listing.primary_pricing_period}` as keyof typeof booking.listing
                    ] as number ?? 0,
                  )}{" "}
                  / {booking.listing.primary_pricing_period}
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-border/70 bg-background p-5 shadow-sm">
            <h2 className="text-lg font-semibold">Booking Details</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div>
                <p className="font-medium">Rental Period</p>
                <p className="text-sm text-muted-foreground">
                  {formatDateRange(booking.start_date, booking.end_date)}
                </p>
              </div>
              <div>
                <p className="font-medium">Quantity</p>
                <p className="text-sm text-muted-foreground">{booking.quantity}</p>
              </div>
            </div>

            <div className="mt-5 space-y-2 rounded-2xl border border-border/70 bg-muted/20 p-4 text-sm">
              <div className="flex items-center justify-between">
                <span>
                  {formatCurrency(booking.unit_price)} x {booking.num_units} x {booking.quantity}
                </span>
                <span>{formatCurrency(booking.subtotal)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Service fee</span>
                <span>{formatCurrency(booking.service_fee_renter)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Deposit</span>
                <span>{formatCurrency(booking.deposit_amount)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Delivery fee</span>
                <span>{formatCurrency(booking.delivery_fee)}</span>
              </div>
              <div className="flex items-center justify-between border-t border-border pt-2 font-semibold">
                <span>Total</span>
                <span>{formatCurrency(booking.total_price)}</span>
              </div>
              {isLister ? (
                <div className="flex items-center justify-between border-t border-border pt-2">
                  <span>Lister payout</span>
                  <span>{formatCurrency(booking.lister_payout)}</span>
                </div>
              ) : null}
            </div>
          </section>

          <section className="rounded-3xl border border-border/70 bg-background p-5 shadow-sm">
            <h2 className="text-lg font-semibold">Fulfillment Details</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {booking.fulfillment_type === "delivery" ? (
                <>
                  <div className="md:col-span-2">
                    <p className="font-medium">Delivery Address</p>
                    <p className="text-sm text-muted-foreground">
                      {[
                        booking.delivery_address,
                        booking.delivery_city,
                        booking.delivery_state,
                        booking.delivery_postal_code,
                      ]
                        .filter(Boolean)
                        .join(", ")}
                    </p>
                  </div>
                  <div>
                    <p className="font-medium">Scheduled Delivery</p>
                    <p className="text-sm text-muted-foreground">
                      {formatDateTime(booking.delivery_scheduled_at)}
                    </p>
                  </div>
                  <div>
                    <p className="font-medium">Delivered At</p>
                    <p className="text-sm text-muted-foreground">
                      {formatDateTime(booking.delivered_at)}
                    </p>
                  </div>
                  <div className="md:col-span-2">
                    <p className="font-medium">Delivery Notes</p>
                    <p className="text-sm whitespace-pre-line text-muted-foreground">
                      {booking.delivery_notes || "None"}
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <p className="font-medium">Pickup Location</p>
                    <p className="text-sm text-muted-foreground">{booking.listing.location}</p>
                  </div>
                  <div>
                    <p className="font-medium">Scheduled Pickup</p>
                    <p className="text-sm text-muted-foreground">
                      {formatDateTime(booking.pickup_scheduled_at)}
                    </p>
                  </div>
                  <div>
                    <p className="font-medium">Picked Up At</p>
                    <p className="text-sm text-muted-foreground">
                      {formatDateTime(booking.picked_up_at)}
                    </p>
                  </div>
                  <div>
                    <p className="font-medium">Pickup Notes</p>
                    <p className="text-sm whitespace-pre-line text-muted-foreground">
                      {booking.pickup_notes || "None"}
                    </p>
                  </div>
                </>
              )}
            </div>
          </section>

          {booking.return_method ||
          booking.return_scheduled_at ||
          booking.returned_at ||
          booking.return_condition ? (
            <section className="rounded-3xl border border-border/70 bg-background p-5 shadow-sm">
              <h2 className="text-lg font-semibold">Return Details</h2>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div>
                  <p className="font-medium">Return Method</p>
                  <p className="text-sm text-muted-foreground">
                    {booking.return_method?.replaceAll("_", " ") || "Not set"}
                  </p>
                </div>
                <div>
                  <p className="font-medium">Return Scheduled</p>
                  <p className="text-sm text-muted-foreground">
                    {formatDateTime(booking.return_scheduled_at)}
                  </p>
                </div>
                <div>
                  <p className="font-medium">Returned At</p>
                  <p className="text-sm text-muted-foreground">
                    {formatDateTime(booking.returned_at)}
                  </p>
                </div>
                <div>
                  <p className="font-medium">Return Condition</p>
                  <p className="text-sm text-muted-foreground">
                    {booking.return_condition?.replaceAll("_", " ") || "Not inspected"}
                  </p>
                </div>
                <div className="md:col-span-2">
                  <p className="font-medium">Return Notes</p>
                  <p className="text-sm whitespace-pre-line text-muted-foreground">
                    {booking.return_notes || booking.return_condition_notes || "None"}
                  </p>
                </div>
              </div>
            </section>
          ) : null}

          <section className="rounded-3xl border border-border/70 bg-background p-5 shadow-sm">
            <h2 className="text-lg font-semibold">Payment Info</h2>
            <div className="mt-4 space-y-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className={paymentTone(booking.hitpay_payment_status)} variant="secondary">
                  {booking.hitpay_payment_status || "pending"}
                </Badge>
                {booking.paid_at ? (
                  <span className="text-muted-foreground">
                    Paid at {formatDateTime(booking.paid_at)}
                  </span>
                ) : null}
              </div>
              {booking.hitpay_payment_id ? (
                <p className="text-muted-foreground">
                  HitPay reference: {booking.hitpay_payment_id}
                </p>
              ) : null}
              {booking.status === "awaiting_payment" && isRenter ? (
                <div className="flex flex-wrap items-center gap-3">
                  {booking.payment_expires_at ? (
                    <PaymentCountdown expiresAt={booking.payment_expires_at} />
                  ) : null}
                  <PaymentButton
                    bookingId={booking.id}
                    paymentUrl={booking.hitpay_payment_url}
                  />
                </div>
              ) : null}
            </div>
          </section>

          <section className="rounded-3xl border border-border/70 bg-background p-5 shadow-sm">
            <h2 className="text-lg font-semibold">Booking Timeline</h2>
            <div className="mt-5">
              <BookingTimeline currentUserId={user.id} timeline={timeline} />
            </div>
          </section>
        </div>

        <div className="space-y-6">
          <section className="rounded-3xl border border-border/70 bg-background p-5 shadow-sm">
            <h2 className="text-lg font-semibold">
              {isLister ? "Renter Info" : isRenter ? "Lister Info" : "Booking Party"}
            </h2>
            <div className="mt-4 flex items-start gap-4">
              <Avatar size="lg">
                <AvatarImage
                  alt={otherParty.display_name || otherParty.full_name}
                  src={otherParty.avatar_url ?? undefined}
                />
                <AvatarFallback>
                  {(otherParty.display_name || otherParty.full_name).slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="space-y-2">
                <p className="font-medium">
                  {otherParty.display_name || otherParty.full_name}
                </p>
                <p className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Star className="size-4 fill-current text-amber-500" />
                  {isLister
                    ? `${otherParty.rating_as_renter.toFixed(1)} renter rating`
                    : `${otherParty.rating_as_lister.toFixed(1)} lister rating`}
                </p>
              </div>
            </div>
            <div className="mt-4">
              <TrustBadges profile={otherParty} />
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              {!isAdmin ? (
                <MessageProfileButton
                  currentUserId={user.id}
                  profileUserId={otherParty.id}
                />
              ) : null}
              <Button asChild variant="outline">
                <Link href={`/users/${otherParty.id}`}>View Profile</Link>
              </Button>
            </div>
          </section>

          <section className="rounded-3xl border border-border/70 bg-background p-5 shadow-sm">
            <h2 className="text-lg font-semibold">Actions</h2>
            <div className="mt-4">
              {isLister ? (
                <RequestActions booking={booking} />
              ) : isRenter ? (
                <RentalActions booking={booking} />
              ) : (
                <p className="text-sm text-muted-foreground">
                  Admin view only. Actions are limited to the booking participants.
                </p>
              )}
            </div>
          </section>

          {booking.status === "completed" ? (
            <section className="rounded-3xl border border-border/70 bg-background p-5 shadow-sm">
              <h2 className="text-lg font-semibold">Reviews</h2>
              <div className="mt-4 space-y-4">
                {reviewItems.length > 0 ? (
                  reviewItems.map((review) => <ReviewCard key={review.id} review={review} />)
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No reviews have been left yet for this booking.
                  </p>
                )}
              </div>
            </section>
          ) : null}
        </div>
      </div>
    </div>
  );
}
