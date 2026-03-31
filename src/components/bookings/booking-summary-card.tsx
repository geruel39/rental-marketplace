import Link from "next/link";
import { format } from "date-fns";

import { BookingStatusBadge } from "@/components/bookings/booking-status-badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn, formatCurrency } from "@/lib/utils";
import type { BookingWithDetails, Profile } from "@/types";

interface BookingSummaryCardProps {
  booking: BookingWithDetails;
  compact?: boolean;
  currentUserId?: string;
}

function getProfileName(profile: Profile) {
  return profile.display_name || profile.full_name || profile.email || "User";
}

function getProfileInitials(profile: Profile) {
  return getProfileName(profile).slice(0, 2).toUpperCase();
}

function getOtherParty(
  booking: BookingWithDetails,
  currentUserId?: string,
) {
  if (!currentUserId) {
    return booking.lister;
  }

  if (booking.renter_id === currentUserId) {
    return booking.lister;
  }

  if (booking.lister_id === currentUserId) {
    return booking.renter;
  }

  return booking.lister;
}

function formatDateRange(startDate: string, endDate: string) {
  return `${format(new Date(startDate), "MMM d")} - ${format(new Date(endDate), "MMM d, yyyy")}`;
}

export function BookingSummaryCard({
  booking,
  compact = false,
  currentUserId,
}: BookingSummaryCardProps) {
  const image = booking.listing.images[0];
  const otherParty = getOtherParty(booking, currentUserId);
  const otherPartyName = getProfileName(otherParty);

  return (
    <article
      className={cn(
        "rounded-2xl border border-border/70 bg-background shadow-sm",
        compact ? "p-3" : "p-4",
      )}
    >
      <div className={cn("gap-4", compact ? "flex items-center" : "flex flex-col sm:flex-row")}>
        <div className={cn("overflow-hidden rounded-2xl bg-muted", compact ? "size-14 shrink-0" : "h-24 w-full sm:size-24 sm:shrink-0")}>
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              alt={booking.listing.title}
              className="h-full w-full object-cover"
              src={image}
            />
          ) : null}
        </div>

        <div className="min-w-0 flex-1 space-y-3">
          <div className={cn("gap-2", compact ? "flex flex-wrap items-center justify-between" : "flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between")}>
            <div className="min-w-0 space-y-1">
              <Link
                className="line-clamp-1 font-semibold transition-colors hover:text-primary hover:underline"
                href={`/dashboard/bookings/${booking.id}`}
              >
                {booking.listing.title}
              </Link>
              <div className="flex flex-wrap items-center gap-2">
                <BookingStatusBadge size="sm" status={booking.status} />
                <Badge variant="outline">
                  {booking.fulfillment_type === "delivery" ? "Delivery" : "Pickup"}
                </Badge>
              </div>
            </div>
            <p className="shrink-0 text-sm font-semibold">
              {formatCurrency(booking.total_price)}
            </p>
          </div>

          <div className={cn("text-sm text-muted-foreground", compact ? "space-y-1" : "grid gap-2 sm:grid-cols-2")}>
            <p>{formatDateRange(booking.start_date, booking.end_date)}</p>
            <p>{booking.quantity} item{booking.quantity === 1 ? "" : "s"}</p>
            <div className="flex items-center gap-2">
              <Avatar size="sm">
                <AvatarImage alt={otherPartyName} src={otherParty.avatar_url ?? undefined} />
                <AvatarFallback>{getProfileInitials(otherParty)}</AvatarFallback>
              </Avatar>
              <span className="line-clamp-1">
                {otherPartyName}
              </span>
            </div>
            {!compact ? (
              <p className="line-clamp-1">
                {booking.fulfillment_type === "delivery"
                  ? booking.delivery_address || booking.delivery_city || "Delivery"
                  : booking.listing.location}
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </article>
  );
}
