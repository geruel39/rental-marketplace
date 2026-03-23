"use client";

import { Calendar } from "@/components/ui/calendar";

interface AvailabilityCalendarProps {
  listingId: string;
  existingBookings: Array<{ start_date: string; end_date: string }>;
}

export function AvailabilityCalendar({
  listingId,
  existingBookings,
}: AvailabilityCalendarProps) {
  const disabled = existingBookings.map((booking) => ({
    from: new Date(booking.start_date),
    to: new Date(booking.end_date),
  }));

  return (
    <div className="rounded-3xl border border-border/70 bg-card p-4 shadow-sm">
      <div className="mb-3 space-y-1">
        <h3 className="font-semibold">Availability</h3>
        <p className="text-sm text-muted-foreground">
          Booked dates for listing {listingId.slice(0, 8)} are disabled.
        </p>
      </div>
      <Calendar
        className="w-full"
        disabled={disabled}
        mode="single"
        selected={new Date()}
      />
    </div>
  );
}
