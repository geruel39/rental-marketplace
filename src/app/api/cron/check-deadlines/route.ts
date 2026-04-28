import { addHours, addMinutes } from "date-fns";
import { NextRequest, NextResponse } from "next/server";

import { expireUnconfirmedBookings } from "@/actions/bookings";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyListerConfirmationWarning } from "@/lib/notifications";

export const dynamic = "force-dynamic";

type ReminderBookingRow = {
  id: string;
  lister_id: string;
  listing_id: string;
  lister_confirmation_deadline: string | null;
  listing: { title: string } | { title: string }[] | null;
};

function unwrapListing(
  listing: ReminderBookingRow["listing"],
): { title: string } | null {
  return Array.isArray(listing) ? (listing[0] ?? null) : listing;
}

async function loadReminderWindow(params: {
  admin: ReturnType<typeof createAdminClient>;
  from: Date;
  to: Date;
}) {
  const { data, error } = await params.admin
    .from("bookings")
    .select(
      "id, lister_id, listing_id, lister_confirmation_deadline, listing:listings!bookings_listing_id_fkey(title)",
    )
    .eq("status", "lister_confirmation")
    .gte("lister_confirmation_deadline", params.from.toISOString())
    .lt("lister_confirmation_deadline", params.to.toISOString());

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as ReminderBookingRow[];
}

export async function POST(request: NextRequest) {
  const secret = request.headers.get("x-cron-secret");
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const admin = createAdminClient();
    const now = new Date();

    const { data: toCancel, error: cancelLookupError } = await admin
      .from("bookings")
      .select("id", { count: "exact" })
      .eq("status", "lister_confirmation")
      .lt("lister_confirmation_deadline", now.toISOString());

    if (cancelLookupError) {
      throw new Error(cancelLookupError.message);
    }

    const expireResult = await expireUnconfirmedBookings();
    if (expireResult.error) {
      throw new Error(expireResult.error);
    }

    const twelveHourBookings = await loadReminderWindow({
      admin,
      from: addMinutes(addHours(now, 11), 30),
      to: addHours(now, 12),
    });
    const twoHourBookings = await loadReminderWindow({
      admin,
      from: addMinutes(addHours(now, 1), 30),
      to: addHours(now, 2),
    });

    await Promise.all([
      ...twelveHourBookings.map((booking) => {
        const listing = unwrapListing(booking.listing);
        return notifyListerConfirmationWarning({
          listerId: booking.lister_id,
          listingTitle: listing?.title ?? "this booking",
          hoursRemaining: 12,
          deadline: new Date(
            booking.lister_confirmation_deadline ?? now,
          ).toLocaleString(),
          bookingId: booking.id,
        });
      }),
      ...twoHourBookings.map((booking) => {
        const listing = unwrapListing(booking.listing);
        return notifyListerConfirmationWarning({
          listerId: booking.lister_id,
          listingTitle: listing?.title ?? "This booking",
          hoursRemaining: 2,
          deadline: new Date(
            booking.lister_confirmation_deadline ?? now,
          ).toLocaleString(),
          bookingId: booking.id,
        });
      }),
    ]);

    return NextResponse.json({
      cancelled: toCancel?.length ?? 0,
      warned: twelveHourBookings.length + twoHourBookings.length,
    });
  } catch (error) {
    console.error("check-deadlines cron failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Cron failed" },
      { status: 500 },
    );
  }
}
