import Link from "next/link";
import { redirect } from "next/navigation";

import { PayoutSettingsForm } from "@/components/profile/payout-settings-form";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { BookingWithDetails, Profile } from "@/types";

export default async function PaymentsSettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [{ data: profile }, { data: payments }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle<Profile>(),
    supabase
      .from("bookings")
      .select(
        `
          *,
          listing:listings!bookings_listing_id_fkey(*),
          renter:profiles!bookings_renter_id_fkey(*),
          lister:profiles!bookings_lister_id_fkey(*)
        `,
      )
      .eq("renter_id", user.id)
      .eq("hitpay_payment_status", "completed")
      .order("created_at", { ascending: false }),
  ]);

  if (!profile) {
    redirect("/dashboard/settings");
  }

  const paymentHistory = (payments ?? []) as BookingWithDetails[];

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">Payment Settings</h1>
          <p className="text-sm text-muted-foreground">
            Manage where your lister earnings are paid and review your completed renter payments.
          </p>
        </div>

        <div className="rounded-3xl border border-border bg-background p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold">Payout Settings</h2>
          <PayoutSettingsForm profile={profile} />
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Payment History</h2>
        <div className="rounded-3xl border border-border bg-background p-4 shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Listing</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Reference</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paymentHistory.map((booking) => (
                <TableRow key={booking.id}>
                  <TableCell>{formatDate(booking.created_at)}</TableCell>
                  <TableCell>
                    <Link href={`/listings/${booking.listing.id}`}>{booking.listing.title}</Link>
                  </TableCell>
                  <TableCell>{formatCurrency(booking.total_price, "SGD")}</TableCell>
                  <TableCell>{booking.hitpay_payment_status ?? "completed"}</TableCell>
                  <TableCell>{booking.hitpay_payment_id ?? booking.id}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>
    </div>
  );
}
