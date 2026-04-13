import { redirect } from "next/navigation";

import { TransactionList } from "@/components/payments/transaction-list";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency } from "@/lib/utils";
import type { PaymentEventType, Profile, Transaction } from "@/types";

type SearchParams = Record<string, string | string[] | undefined>;

function getSingleValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function isEventType(value?: string): value is PaymentEventType {
  return Boolean(
    value &&
      [
        "payment_initiated",
        "payment_completed",
        "payment_failed",
        "payment_expired",
        "refund_initiated",
        "refund_completed",
        "refund_failed",
        "payout_initiated",
        "payout_completed",
        "payout_failed",
        "payout_retry_requested",
        "dispute_hold",
        "dispute_released_lister",
        "dispute_released_renter",
        "dispute_split",
      ].includes(value),
  );
}

export default async function AdminTransactionsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/dashboard");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle<Pick<Profile, "is_admin">>();

  if (!profile?.is_admin) {
    redirect("/dashboard");
  }

  const resolvedSearchParams = await searchParams;
  const eventType = getSingleValue(resolvedSearchParams.event_type);
  const status = getSingleValue(resolvedSearchParams.status);
  const dateFrom = getSingleValue(resolvedSearchParams.date_from);
  const dateTo = getSingleValue(resolvedSearchParams.date_to);
  const bookingId = getSingleValue(resolvedSearchParams.booking_id);

  const admin = createAdminClient();
  let query = admin.from("transactions").select("*").order("created_at", { ascending: false });

  if (isEventType(eventType)) {
    query = query.eq("event_type", eventType);
  }

  if (status && ["pending", "processing", "completed", "failed"].includes(status)) {
    query = query.eq("status", status);
  }

  if (dateFrom) {
    query = query.gte("created_at", new Date(dateFrom).toISOString());
  }

  if (dateTo) {
    const end = new Date(dateTo);
    end.setHours(23, 59, 59, 999);
    query = query.lte("created_at", end.toISOString());
  }

  if (bookingId) {
    query = query.eq("booking_id", bookingId);
  }

  const { data } = await query;
  const transactions = ((data ?? []) as Transaction[]) ?? [];
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const totalVolume = transactions.reduce((sum, transaction) => sum + transaction.gross_amount, 0);
  const todayVolume = transactions
    .filter((transaction) => new Date(transaction.created_at) >= startOfToday)
    .reduce((sum, transaction) => sum + transaction.gross_amount, 0);
  const totalFeesCollected = transactions.reduce(
    (sum, transaction) => sum + transaction.platform_fee,
    0,
  );
  const totalPaidOut = transactions
    .filter((transaction) => transaction.event_type === "payout_completed")
    .reduce((sum, transaction) => sum + transaction.net_amount, 0);

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Transactions</h1>
        <p className="text-sm text-muted-foreground">
          Platform-wide view of payment intake, payouts, refunds, and dispute money flow.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-3xl border border-border/70 bg-white p-5 shadow-sm">
          <p className="text-sm text-muted-foreground">Total volume</p>
          <p className="mt-2 text-3xl font-semibold text-brand-navy">
            {formatCurrency(totalVolume, "SGD")}
          </p>
        </div>
        <div className="rounded-3xl border border-border/70 bg-white p-5 shadow-sm">
          <p className="text-sm text-muted-foreground">Today's volume</p>
          <p className="mt-2 text-3xl font-semibold text-brand-navy">
            {formatCurrency(todayVolume, "SGD")}
          </p>
        </div>
        <div className="rounded-3xl border border-border/70 bg-white p-5 shadow-sm">
          <p className="text-sm text-muted-foreground">Total fees collected</p>
          <p className="mt-2 text-3xl font-semibold text-brand-navy">
            {formatCurrency(totalFeesCollected, "SGD")}
          </p>
        </div>
        <div className="rounded-3xl border border-border/70 bg-white p-5 shadow-sm">
          <p className="text-sm text-muted-foreground">Paid out to listers</p>
          <p className="mt-2 text-3xl font-semibold text-brand-navy">
            {formatCurrency(totalPaidOut, "SGD")}
          </p>
        </div>
      </div>

      <section className="rounded-3xl border border-border/70 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-end gap-3">
          <form className="flex flex-wrap items-end gap-3" method="get">
            <label className="text-sm text-muted-foreground">
              Event type
              <input
                className="mt-1 block rounded-xl border border-border px-3 py-2 text-sm text-foreground"
                defaultValue={eventType ?? ""}
                name="event_type"
                placeholder="payment_completed"
              />
            </label>
            <label className="text-sm text-muted-foreground">
              Status
              <input
                className="mt-1 block rounded-xl border border-border px-3 py-2 text-sm text-foreground"
                defaultValue={status ?? ""}
                name="status"
                placeholder="completed"
              />
            </label>
            <label className="text-sm text-muted-foreground">
              Date from
              <input
                className="mt-1 block rounded-xl border border-border px-3 py-2 text-sm text-foreground"
                defaultValue={dateFrom ?? ""}
                name="date_from"
                type="date"
              />
            </label>
            <label className="text-sm text-muted-foreground">
              Date to
              <input
                className="mt-1 block rounded-xl border border-border px-3 py-2 text-sm text-foreground"
                defaultValue={dateTo ?? ""}
                name="date_to"
                type="date"
              />
            </label>
            <label className="text-sm text-muted-foreground">
              Booking ID
              <input
                className="mt-1 block rounded-xl border border-border px-3 py-2 text-sm text-foreground"
                defaultValue={bookingId ?? ""}
                name="booking_id"
                placeholder="UUID"
              />
            </label>
            <Button className="bg-brand-navy text-white hover:bg-brand-steel" type="submit">
              Apply Filters
            </Button>
          </form>
          <Button asChild type="button" variant="outline">
            <a href="/admin/transactions">Reset</a>
          </Button>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Badge variant="outline">Platform kept {formatCurrency(totalFeesCollected, "SGD")}</Badge>
          <Badge variant="outline">Paid out {formatCurrency(totalPaidOut, "SGD")}</Badge>
        </div>
      </section>

      <TransactionList showBookingRef transactions={transactions} />
    </div>
  );
}
