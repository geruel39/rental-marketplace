import Link from "next/link";
import { Wallet } from "lucide-react";
import { redirect } from "next/navigation";

import { getPayoutsForUser } from "@/actions/profile";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
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

export default async function EarningsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const payouts = await getPayoutsForUser(user.id);
  const totalEarned = payouts.reduce((sum, payout) => sum + payout.amount, 0);
  const pendingPayouts = payouts.filter((payout) => payout.status !== "completed");
  const completedPayouts = payouts.filter((payout) => payout.status === "completed");

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Earnings</h1>
        <p className="text-sm text-muted-foreground">
          Track lister payouts and see when completed bookings turn into earnings.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-3xl border border-border bg-background p-5 shadow-sm">
          <p className="text-sm text-muted-foreground">Total Earned</p>
          <p className="mt-2 text-3xl font-semibold">{formatCurrency(totalEarned, "SGD")}</p>
        </div>
        <div className="rounded-3xl border border-border bg-background p-5 shadow-sm">
          <p className="text-sm text-muted-foreground">Pending Payouts</p>
          <p className="mt-2 text-3xl font-semibold">{pendingPayouts.length}</p>
        </div>
        <div className="rounded-3xl border border-border bg-background p-5 shadow-sm">
          <p className="text-sm text-muted-foreground">Completed Payouts</p>
          <p className="mt-2 text-3xl font-semibold">{completedPayouts.length}</p>
        </div>
      </div>

      {payouts.length === 0 ? (
        <EmptyState
          actionHref="/dashboard/my-listings"
          actionLabel="View My Listings"
          description="Payouts will appear here after your bookings are completed and processed."
          icon={Wallet}
          title="No earnings yet"
        />
      ) : (
        <div className="rounded-3xl border border-border bg-background p-4 shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Booking Ref</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Method</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payouts.map((payout) => (
                <TableRow key={payout.id}>
                  <TableCell>{formatDate(payout.created_at)}</TableCell>
                  <TableCell>
                    {payout.booking_id ? (
                      <Link href="/dashboard/requests">{payout.booking_id.slice(0, 8)}</Link>
                    ) : (
                      "-"
                    )}
                  </TableCell>
                  <TableCell>{formatCurrency(payout.amount, payout.currency)}</TableCell>
                  <TableCell>
                    <Badge variant={payout.status === "completed" ? "default" : "secondary"}>
                      {payout.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{payout.payout_method ?? "Manual"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
