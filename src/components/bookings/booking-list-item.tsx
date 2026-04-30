import Link from "next/link";
import { Star } from "lucide-react";

import { BookingStatusBadge } from "@/components/bookings/booking-status-badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn, formatCurrency, getInitials } from "@/lib/utils";
import type { BookingWithDetails } from "@/types";

interface BookingListItemProps {
  booking: BookingWithDetails;
  counterpartAvatarUrl?: string | null;
  counterpartLabel: string;
  counterpartName: string;
  counterpartRating: number;
  detailHref: string;
  note?: React.ReactNode;
  countdown?: React.ReactNode;
  actionPanel: React.ReactNode;
  urgent?: boolean;
}

function formatDuration(booking: BookingWithDetails) {
  const units = booking.rental_units || booking.num_units || 1;
  return `${units} ${booking.pricing_period}${units === 1 ? "" : "s"}`;
}

export function BookingListItem({
  booking,
  counterpartAvatarUrl,
  counterpartLabel,
  counterpartName,
  counterpartRating,
  detailHref,
  note,
  countdown,
  actionPanel,
  urgent = false,
}: BookingListItemProps) {
  return (
    <article
      className={cn(
        "rounded-[28px] border border-border/70 bg-white p-4 shadow-sm shadow-black/5 md:p-5",
        urgent && "border-amber-300/80 shadow-amber-100/40",
      )}
    >
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px] xl:items-stretch">
        <div className="flex min-w-0 items-start gap-4">
          <Link
            className="block size-[80px] shrink-0 overflow-hidden rounded-2xl bg-muted md:size-[88px]"
            href={`/listings/${booking.listing.id}`}
          >
            {booking.listing.images[0] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                alt={booking.listing.title}
                className="h-full w-full object-cover"
                src={booking.listing.images[0]}
              />
            ) : null}
          </Link>

          <div className="min-w-0 flex-1 space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 space-y-2">
                <p className="line-clamp-2 text-base font-semibold tracking-tight text-foreground md:text-lg">
                  {booking.listing.title}
                </p>
                <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                  <Avatar size="sm">
                    <AvatarImage
                      alt={counterpartName}
                      src={counterpartAvatarUrl ?? undefined}
                    />
                    <AvatarFallback>{getInitials(counterpartName)}</AvatarFallback>
                  </Avatar>
                  <span className="font-medium text-foreground">
                    {counterpartLabel}: {counterpartName}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Star className="size-3.5 fill-current text-amber-500" />
                    {counterpartRating.toFixed(1)}
                  </span>
                </div>
              </div>

              <div className="shrink-0">
                <BookingStatusBadge size="sm" status={booking.status} />
              </div>
            </div>

            <div className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2 xl:grid-cols-3">
              <div className="rounded-2xl border border-border/70 bg-muted/20 px-3 py-2.5">
                <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground/80">
                  Duration
                </p>
                <p className="mt-1 font-medium text-foreground">
                  {formatDuration(booking)} x {booking.quantity} item{booking.quantity === 1 ? "" : "s"}
                </p>
              </div>
              <div className="rounded-2xl border border-border/70 bg-muted/20 px-3 py-2.5">
                <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground/80">
                  Total Paid
                </p>
                <p className="mt-1 font-semibold text-brand-navy">
                  {formatCurrency(booking.total_price)}
                </p>
              </div>
              <div className="rounded-2xl border border-border/70 bg-muted/20 px-3 py-2.5 sm:col-span-2 xl:col-span-1">
                <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground/80">
                  Booking ID
                </p>
                <p className="mt-1 font-medium text-foreground">
                  #{booking.id.slice(0, 8)}
                </p>
              </div>
            </div>

            {note ? (
              <div className="rounded-2xl border border-border/70 bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
                {note}
              </div>
            ) : null}

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <Link
                className="inline-flex items-center text-sm font-medium text-brand-navy hover:underline"
                href={detailHref}
              >
                View details
              </Link>

              {countdown ? <div className="min-w-0 sm:max-w-[360px]">{countdown}</div> : null}
            </div>
          </div>
        </div>

        <div className="w-full xl:w-[300px] xl:justify-self-end">
          <div className="flex min-h-[184px] flex-col justify-between rounded-[24px] border border-border/70 bg-muted/20 p-4">
            {actionPanel}
          </div>
        </div>
      </div>
    </article>
  );
}
