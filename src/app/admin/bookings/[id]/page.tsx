import Link from "next/link";
import { notFound } from "next/navigation";

import { DisputeResolveDialog } from "@/components/admin/dispute-resolve-dialog";
import { BookingAdminNotes } from "@/components/admin/booking-admin-notes";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { BookingWithDetails, Message } from "@/types";

async function verifyAdminAccess() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Unauthorized");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle<{ is_admin: boolean }>();

  if (!profile?.is_admin) {
    throw new Error("Unauthorized");
  }
}

export default async function AdminBookingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await verifyAdminAccess();
  const { id } = await params;
  const admin = createAdminClient();

  const { data: bookingRaw, error } = await admin
    .from("bookings")
    .select(
      `
        *,
        listing:listings!bookings_listing_id_fkey(*),
        renter:profiles!bookings_renter_id_fkey(*),
        lister:profiles!bookings_lister_id_fkey(*)
      `,
    )
    .eq("id", id)
    .maybeSingle();

  if (error || !bookingRaw) {
    notFound();
  }

  const booking = bookingRaw as BookingWithDetails;

  const [messagesResult, timelineResult] = await Promise.all([
    admin
      .from("conversations")
      .select("id")
      .eq("booking_id", booking.id)
      .maybeSingle<{ id: string }>(),
    admin
      .from("admin_audit_log")
      .select("*")
      .eq("target_type", "booking")
      .eq("target_id", booking.id)
      .order("created_at", { ascending: false }),
  ]);

  const messages =
    messagesResult.data
      ? (
          await admin
            .from("messages")
            .select("*")
            .eq("conversation_id", messagesResult.data.id)
            .order("created_at", { ascending: true })
        ).data ?? []
      : [];

  const timelineEvents = [
    { label: "Booking created", date: booking.created_at },
    booking.paid_at ? { label: "Payment completed", date: booking.paid_at } : null,
    booking.cancelled_at
      ? { label: `Booking cancelled (${booking.status})`, date: booking.cancelled_at }
      : null,
    booking.dispute_resolved_at
      ? { label: "Dispute resolved", date: booking.dispute_resolved_at }
      : null,
    booking.payout_at ? { label: "Payout recorded", date: booking.payout_at } : null,
    ...((timelineResult.data ?? []) as Array<{ action: string; created_at: string }>).map(
      (entry) => ({
        label: entry.action.replaceAll("_", " "),
        date: entry.created_at,
      }),
    ),
  ]
    .filter((entry): entry is { label: string; date: string } => Boolean(entry))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const paymentStatus =
    booking.hitpay_payment_status || (booking.paid_at ? "paid" : "unpaid");

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Booking Detail"
        description="Inspect booking operations, payment state, dispute notes, and the full communication trail."
        action={
          <Link
            className="inline-flex h-9 items-center justify-center rounded-md border border-border bg-white px-4 text-sm font-medium text-brand-navy shadow-xs transition-colors hover:bg-brand-light"
            href="/admin/bookings"
          >
            Back to bookings
          </Link>
        }
      />

      {booking.status === "disputed" ? (
        <Card className="border-red-200 bg-red-50/70 shadow-sm">
          <CardHeader>
            <CardTitle className="text-red-950">Dispute Resolution</CardTitle>
            <CardDescription className="text-red-900/80">
              This booking is currently disputed and needs an admin decision.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-red-900">
              {booking.dispute_resolution || "No dispute resolution has been recorded yet."}
            </p>
            <DisputeResolveDialog
              booking={booking}
              trigger={
                <Button className="bg-red-600 text-white hover:bg-red-700">
                  Resolve Dispute
                </Button>
              }
            />
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-6">
          <Card className="border-border/70 bg-white shadow-sm">
            <CardHeader>
              <CardTitle>Booking Info</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <DetailCard label="Booking ID" value={booking.id} />
              <DetailCard label="Status" value={booking.status} />
              <DetailCard
                label="Dates"
                value={`${formatDate(booking.start_date)} - ${formatDate(booking.end_date)}`}
              />
              <DetailCard label="Quantity" value={String(booking.quantity)} />
              <DetailCard label="Pricing period" value={booking.pricing_period} />
              <DetailCard label="Total price" value={formatCurrency(booking.total_price)} />
            </CardContent>
          </Card>

          <Card className="border-border/70 bg-white shadow-sm">
            <CardHeader>
              <CardTitle>Pricing Breakdown</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <DetailCard label="Subtotal" value={formatCurrency(booking.subtotal)} />
              <DetailCard label="Renter fee" value={formatCurrency(booking.service_fee_renter)} />
              <DetailCard label="Lister fee" value={formatCurrency(booking.service_fee_lister)} />
              <DetailCard label="Delivery fee" value={formatCurrency(booking.delivery_fee)} />
              <DetailCard label="Deposit" value={formatCurrency(booking.deposit_amount)} />
              <DetailCard label="Lister payout" value={formatCurrency(booking.lister_payout)} />
            </CardContent>
          </Card>

          <Card className="border-border/70 bg-white shadow-sm">
            <CardHeader>
              <CardTitle>Message History</CardTitle>
              <CardDescription>Admin-visible conversation thread between renter and lister.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {(messages as Message[]).length === 0 ? (
                <p className="text-sm text-muted-foreground">No direct messages found for this booking.</p>
              ) : (
                (messages as Message[]).map((message) => (
                  <div
                    key={message.id}
                    className="rounded-2xl border border-brand-navy/10 bg-brand-light p-4"
                  >
                    <p className="text-xs font-medium uppercase tracking-[0.16em] text-brand-navy">
                      {message.sender_id === booking.renter.id ? "Renter" : "Lister"} ·{" "}
                      {formatDate(message.created_at)}
                    </p>
                    <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">
                      {message.content}
                    </p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="border-border/70 bg-white shadow-sm">
            <CardHeader>
              <CardTitle>Listing Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="overflow-hidden rounded-2xl bg-muted">
                {booking.listing.images[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    alt={booking.listing.title}
                    className="h-48 w-full object-cover"
                    src={booking.listing.images[0]}
                  />
                ) : null}
              </div>
              <p className="font-medium text-foreground">{booking.listing.title}</p>
              <Button asChild variant="outline">
                <Link href={`/admin/listings/${booking.listing.id}`}>Open Listing</Link>
              </Button>
            </CardContent>
          </Card>

          <ProfileCard
            email={booking.renter.email}
            href={`/admin/users/${booking.renter.id}`}
            title="Renter"
            value={booking.renter.display_name || booking.renter.full_name || booking.renter.email}
          />
          <ProfileCard
            email={booking.lister.email}
            href={`/admin/users/${booking.lister.id}`}
            title="Lister"
            value={booking.lister.display_name || booking.lister.full_name || booking.lister.email}
          />

          <Card className="border-border/70 bg-white shadow-sm">
            <CardHeader>
              <CardTitle>Payment Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <DetailRow label="HitPay request" value={booking.hitpay_payment_request_id || "-"} />
              <DetailRow label="HitPay payment" value={booking.hitpay_payment_id || "-"} />
              <DetailRow label="Payment status" value={paymentStatus} />
              <DetailRow label="Paid at" value={booking.paid_at ? formatDate(booking.paid_at) : "-"} />
              <DetailRow label="Payout at" value={booking.payout_at ? formatDate(booking.payout_at) : "-"} />
            </CardContent>
          </Card>

          <Card className="border-border/70 bg-white shadow-sm">
            <CardHeader>
              <CardTitle>Stock Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <DetailRow label="Stock deducted" value={booking.stock_deducted ? "Yes" : "No"} />
              <DetailRow label="Stock restored" value={booking.stock_restored ? "Yes" : "No"} />
            </CardContent>
          </Card>

          <Card className="border-border/70 bg-white shadow-sm">
            <CardHeader>
              <CardTitle>Admin Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <BookingAdminNotes bookingId={booking.id} initialNotes={booking.admin_notes} />
            </CardContent>
          </Card>

          <Card className="border-border/70 bg-white shadow-sm">
            <CardHeader>
              <CardTitle>Timeline</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {timelineEvents.map((event) => (
                <div
                  key={`${event.label}-${event.date}`}
                  className="rounded-2xl border border-brand-navy/10 bg-brand-light p-3"
                >
                  <p className="font-medium text-foreground">{event.label}</p>
                  <p className="text-sm text-muted-foreground">{formatDate(event.date)}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function DetailCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-brand-navy/10 bg-brand-light p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold text-foreground">{value}</p>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-brand-navy/10 pb-3 last:border-b-0 last:pb-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium text-foreground">{value}</span>
    </div>
  );
}

function ProfileCard({
  title,
  value,
  email,
  href,
}: {
  title: string;
  value: string;
  email: string;
  href: string;
}) {
  return (
    <Card className="border-border/70 bg-white shadow-sm">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <p className="font-medium text-foreground">{value}</p>
        <p className="text-muted-foreground">{email}</p>
        <Button asChild variant="outline">
          <Link href={href}>Open Admin User Profile</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

