import { format } from "date-fns";
import { Star } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import {
  cancelBooking,
  getBookingDetails,
  getBookingTimeline,
  raiseDispute,
} from "@/actions/bookings";
import { BookingStatusBadge } from "@/components/bookings/booking-status-badge";
import { BookingTimeline } from "@/components/bookings/booking-timeline";
import { ConditionCheckForm } from "@/components/bookings/condition-check-form";
import { HandoverDialog } from "@/components/bookings/handover-dialog";
import { PaymentButton } from "@/components/bookings/payment-button";
import { PaymentCountdown } from "@/components/bookings/payment-countdown";
import { RentalCountdown } from "@/components/bookings/rental-countdown";
import { ReturnDialog } from "@/components/bookings/return-dialog";
import { MessageProfileButton } from "@/components/profile/message-profile-button";
import { TrustBadges } from "@/components/profile/trust-badges";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { createClient } from "@/lib/supabase/server";
import { cn, formatCurrency, getInitials } from "@/lib/utils";
import type { BookingTimelineWithActor } from "@/types";

interface BookingDetailPageProps {
  params: Promise<{ id: string }>;
}

function formatDateTime(value?: string | null) {
  if (!value) return "Not available";
  return format(new Date(value), "PPP p");
}

function formatDuration(units: number, period: string) {
  return `${units} ${period}${units === 1 ? "" : "s"}`;
}

function getConditionTone(condition?: string | null) {
  switch (condition) {
    case "excellent":
      return "bg-emerald-100 text-emerald-800";
    case "good":
      return "bg-blue-100 text-blue-800";
    case "fair":
      return "bg-yellow-100 text-yellow-800";
    case "damaged":
    case "missing_parts":
      return "bg-red-100 text-red-800";
    default:
      return "bg-muted text-muted-foreground";
  }
}

function PhotoGrid({ photos, alt }: { photos: string[]; alt: string }) {
  if (!photos.length) {
    return <p className="text-sm text-muted-foreground">No photos uploaded yet.</p>;
  }

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
      {photos.map((url) => (
        <a href={url} key={url} rel="noreferrer" target="_blank">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img alt={alt} className="h-28 w-full rounded-xl border object-cover" src={url} />
        </a>
      ))}
    </div>
  );
}

function extractProofUrls(entry: BookingTimelineWithActor) {
  const metadata = entry.metadata as Record<string, unknown> | undefined;
  if (!metadata) return [];

  const raw = metadata.photo_urls ?? metadata.proof_photos ?? metadata.proof_urls;
  if (!Array.isArray(raw)) return [];

  return raw.filter((value): value is string => typeof value === "string" && value.length > 0);
}

export default async function BookingDetailPage({ params }: BookingDetailPageProps) {
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
  if (!booking) {
    redirect("/dashboard");
  }

  const timeline = await getBookingTimeline(booking.id);
  const isAdmin = profile?.is_admin ?? false;
  const isLister = booking.lister_id === user.id;
  const isRenter = booking.renter_id === user.id;

  if (!isAdmin && !isLister && !isRenter) {
    redirect("/dashboard");
  }

  const otherParty = isLister ? booking.renter : booking.lister;
  const otherPartyName = otherParty.display_name || otherParty.full_name;
  const rentalUnits = booking.rental_units || booking.num_units || 1;
  const canCancel =
    booking.status === "pending" ||
    booking.status === "awaiting_payment" ||
    booking.status === "confirmed";
  const canDispute = booking.status === "active" || booking.status === "returned";

  const { data: payout } = isLister
    ? await supabase
        .from("payouts")
        .select("status, amount, processed_at")
        .eq("booking_id", booking.id)
        .maybeSingle<{ status: string; amount: number; processed_at: string | null }>()
    : { data: null };

  const isLateReturn =
    Boolean(booking.returned_at) &&
    Boolean(booking.rental_ends_at) &&
    new Date(booking.returned_at as string).getTime() > new Date(booking.rental_ends_at as string).getTime();

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-border/70 bg-background p-5 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">Booking #{booking.id.slice(0, 8)}</h1>
          <BookingStatusBadge size="md" status={booking.status} />
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          Created {formatDateTime(booking.created_at)} · {formatDuration(rentalUnits, booking.pricing_period)}
        </p>
      </section>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <section className="rounded-2xl border border-border/70 bg-background p-5 shadow-sm">
            <h2 className="text-lg font-semibold">Listing</h2>
            <div className="mt-4 flex items-start gap-4">
              <div className="size-24 overflow-hidden rounded-xl bg-muted">
                {booking.listing.images[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img alt={booking.listing.title} className="h-full w-full object-cover" src={booking.listing.images[0]} />
                ) : null}
              </div>
              <div className="space-y-1">
                <Link className="text-lg font-medium hover:text-brand-navy hover:underline" href={`/listings/${booking.listing.id}`}>
                  {booking.listing.title}
                </Link>
                <p className="text-sm text-muted-foreground">
                  {formatCurrency(booking.unit_price)} / {booking.pricing_period}
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-border/70 bg-background p-5 shadow-sm">
            <h2 className="text-lg font-semibold">Rental Details</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div>
                <p className="font-medium">Rental duration</p>
                <p className="text-sm text-muted-foreground">{formatDuration(rentalUnits, booking.pricing_period)}</p>
              </div>
              <div>
                <p className="font-medium">Quantity</p>
                <p className="text-sm text-muted-foreground">
                  {booking.quantity} item{booking.quantity === 1 ? "" : "s"}
                </p>
              </div>
            </div>

            <div className="mt-4 space-y-2 rounded-xl border border-border/70 bg-muted/20 p-4 text-sm">
              <div className="flex items-center justify-between">
                <span>
                  {formatCurrency(booking.unit_price)} × {rentalUnits} {booking.pricing_period}(s) × {booking.quantity}
                </span>
                <span>{formatCurrency(booking.subtotal)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Service fee</span>
                <span>{formatCurrency(booking.service_fee_renter)}</span>
              </div>
              {booking.deposit_amount > 0 ? (
                <div className="flex items-center justify-between">
                  <span>Security deposit</span>
                  <span>{formatCurrency(booking.deposit_amount)}</span>
                </div>
              ) : null}
              <div className="flex items-center justify-between border-t border-border pt-2 font-semibold text-brand-navy">
                <span>Total</span>
                <span>{formatCurrency(booking.total_price)}</span>
              </div>
            </div>
          </section>

          {booking.rental_started_at ? (
            <section className="rounded-2xl border border-border/70 bg-background p-5 shadow-sm">
              <h2 className="text-lg font-semibold">Rental Period</h2>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <div>
                  <p className="font-medium">Rental Started</p>
                  <p className="text-sm text-muted-foreground">{formatDateTime(booking.rental_started_at)}</p>
                </div>
                <div>
                  <p className="font-medium">Return Deadline</p>
                  <p className="text-sm text-muted-foreground">{formatDateTime(booking.rental_ends_at)}</p>
                </div>
              </div>
              {booking.rental_ends_at ? (
                <div className="mt-4">
                  <RentalCountdown rentalEndsAt={booking.rental_ends_at} rentalStartedAt={booking.rental_started_at} />
                </div>
              ) : null}
              {booking.returned_at ? (
                <p className={cn("mt-3 text-sm", isLateReturn ? "text-red-700" : "text-emerald-700")}>
                  Returned: {formatDateTime(booking.returned_at)} {isLateReturn ? "(Late)" : "(On time)"}
                </p>
              ) : null}
            </section>
          ) : null}

          <section className="rounded-2xl border border-border/70 bg-background p-5 shadow-sm">
            <h2 className="text-lg font-semibold">Proof Photos</h2>
            <div className="mt-4 space-y-6">
              <div className="space-y-2">
                <h3 className="font-medium">Handover Proof</h3>
                {booking.handover_proof_urls.length > 0 ? (
                  <>
                    <PhotoGrid alt="Handover proof" photos={booking.handover_proof_urls} />
                    <p className="text-sm text-muted-foreground">
                      Handover date: {formatDateTime(booking.handover_at)} {booking.handover_notes ? `· ${booking.handover_notes}` : ""}
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">Not yet handed over.</p>
                )}
              </div>

              <div className="space-y-2">
                <h3 className="font-medium">Return Proof</h3>
                {booking.return_proof_urls.length > 0 ? (
                  <>
                    <PhotoGrid alt="Return proof" photos={booking.return_proof_urls} />
                    <p className={cn("text-sm", isLateReturn ? "text-red-700" : "text-muted-foreground")}>
                      Return date: {formatDateTime(booking.returned_at)}
                      {booking.return_notes ? ` · ${booking.return_notes}` : ""}
                      {isLateReturn ? " · Late return" : ""}
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">Not yet returned.</p>
                )}
              </div>
            </div>
          </section>

          {booking.return_condition ? (
            <section className="rounded-2xl border border-border/70 bg-background p-5 shadow-sm">
              <h2 className="text-lg font-semibold">Return Condition</h2>
              <div className="mt-4 space-y-3">
                <span
                  className={cn(
                    "inline-flex rounded-full px-2.5 py-1 text-xs font-medium capitalize",
                    getConditionTone(booking.return_condition),
                  )}
                >
                  {booking.return_condition.replaceAll("_", " ")}
                </span>
                {booking.return_condition_notes ? (
                  <p className="text-sm text-muted-foreground">{booking.return_condition_notes}</p>
                ) : null}
              </div>
            </section>
          ) : null}

          <Separator />

          <section className="space-y-4 rounded-2xl border border-border/70 bg-background p-5 shadow-sm">
            <h2 className="text-lg font-semibold">Timeline</h2>
            <BookingTimeline currentUserId={user.id} timeline={timeline} />
            {timeline.some((entry) => extractProofUrls(entry).length > 0) ? (
              <div className="space-y-3">
                {timeline
                  .filter((entry) => extractProofUrls(entry).length > 0)
                  .map((entry) => (
                    <div className="space-y-2 rounded-xl border border-border/70 bg-muted/20 p-3" key={entry.id}>
                      <p className="text-sm font-medium">{entry.title}</p>
                      <div className="grid grid-cols-4 gap-2">
                        {extractProofUrls(entry).slice(0, 4).map((url) => (
                          <a href={url} key={url} rel="noreferrer" target="_blank">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img alt="Timeline proof" className="h-14 w-full rounded-md border object-cover" src={url} />
                          </a>
                        ))}
                      </div>
                    </div>
                  ))}
              </div>
            ) : null}
          </section>
        </div>

        <div className="space-y-6">
          <section className="rounded-2xl border border-border/70 bg-background p-5 shadow-sm">
            <h2 className="text-lg font-semibold">{isLister ? "Renter" : "Lister"}</h2>
            <div className="mt-4 flex items-start gap-3">
              <Avatar size="lg">
                <AvatarImage alt={otherPartyName} src={otherParty.avatar_url ?? undefined} />
                <AvatarFallback>{getInitials(otherPartyName)}</AvatarFallback>
              </Avatar>
              <div className="space-y-1">
                <p className="font-medium">{otherPartyName}</p>
                <p className="inline-flex items-center gap-1 text-sm text-muted-foreground">
                  <Star className="size-4 fill-current text-amber-500" />
                  {isLister ? otherParty.rating_as_renter.toFixed(1) : otherParty.rating_as_lister.toFixed(1)}
                </p>
              </div>
            </div>
            <div className="mt-4">
              <TrustBadges profile={otherParty} />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {!isAdmin ? <MessageProfileButton currentUserId={user.id} profileUserId={otherParty.id} /> : null}
              <Button asChild size="sm" variant="outline">
                <Link href={`/users/${otherParty.id}`}>View Profile</Link>
              </Button>
            </div>
          </section>

          <section className="rounded-2xl border border-border/70 bg-background p-5 shadow-sm">
            <h2 className="text-lg font-semibold">Actions</h2>
            <div className="mt-4 space-y-3">
              {isLister && booking.status === "confirmed" ? <HandoverDialog booking={booking} /> : null}
              {isLister && booking.status === "returned" ? <ConditionCheckForm booking={booking} /> : null}
              {isRenter && booking.status === "awaiting_payment" ? (
                <PaymentButton
                  bookingId={booking.id}
                  className="w-full bg-brand-navy text-white hover:bg-brand-steel"
                  paymentUrl={booking.hitpay_payment_url}
                />
              ) : null}
              {isRenter && booking.status === "active" ? <ReturnDialog booking={booking} /> : null}
              {canCancel ? (
                <form
                  action={
                    cancelBooking.bind(
                      null,
                      booking.id,
                      "Cancelled from booking details page.",
                    ) as unknown as (formData: FormData) => Promise<void>
                  }
                >
                  <Button className="w-full" variant="outline">
                    Cancel Booking
                  </Button>
                </form>
              ) : null}
              {canDispute ? (
                <form
                  action={
                    raiseDispute.bind(
                      null,
                      booking.id,
                      "Dispute raised from booking details page.",
                    ) as unknown as (formData: FormData) => Promise<void>
                  }
                >
                  <Button className="w-full" variant="outline">
                    Raise Dispute
                  </Button>
                </form>
              ) : null}
              {booking.status === "completed" && ((isLister && !booking.lister_reviewed) || (isRenter && !booking.renter_reviewed)) ? (
                <Button asChild className="w-full" variant="outline">
                  <Link href="/dashboard/reviews">Leave Review</Link>
                </Button>
              ) : null}
            </div>
          </section>

          <section className="rounded-2xl border border-border/70 bg-background p-5 shadow-sm">
            <h2 className="text-lg font-semibold">Payment</h2>
            <div className="mt-4 space-y-2 text-sm">
              <p>
                Status:{" "}
                <Badge variant="outline">
                  {(booking.hitpay_payment_status || "pending").replaceAll("_", " ")}
                </Badge>
              </p>
              {booking.status === "awaiting_payment" && booking.payment_expires_at ? (
                <PaymentCountdown expiresAt={booking.payment_expires_at} />
              ) : null}
              {booking.paid_at ? <p className="text-muted-foreground">Paid at: {formatDateTime(booking.paid_at)}</p> : null}
              {booking.hitpay_payment_id ? (
                <p className="text-muted-foreground">HitPay reference: {booking.hitpay_payment_id}</p>
              ) : null}

              {isLister ? (
                <div className="rounded-xl border border-border/70 bg-muted/20 p-3">
                  <p className="font-medium">Payout</p>
                  <p className="text-muted-foreground">Amount: {formatCurrency(booking.lister_payout)}</p>
                  <p className="text-muted-foreground">
                    Status: {payout?.status ? payout.status.replaceAll("_", " ") : booking.payout_at ? "completed" : "pending"}
                  </p>
                </div>
              ) : null}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
