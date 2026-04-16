import Link from "next/link";
import { AlertTriangle, Building2, CreditCard, Download, Smartphone, Wallet } from "lucide-react";
import { redirect } from "next/navigation";

import {
  getEarningsSummary,
  getTransactionsForLister,
  reconcileMissingPayoutsForLister,
} from "@/actions/payments";
import { PayoutStatusCard } from "@/components/payments/payout-status-card";
import { TransactionList } from "@/components/payments/transaction-list";
import { PayoutDetailsDisplay } from "@/components/payout/payout-details-display";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { Payout, Profile, Transaction } from "@/types";

type SearchParams = Record<string, string | string[] | undefined>;

type EarningsPayoutRow = Payout & {
  booking: { id: string } | null;
};

function getSingleValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function getMethodIcon(method?: string | null) {
  switch (method) {
    case "bank":
      return Building2;
    case "maya":
      return CreditCard;
    case "gcash":
      return Smartphone;
    default:
      return Wallet;
  }
}

function filterTransactions(transactions: Transaction[], filter: string) {
  if (filter === "payouts") {
    return transactions.filter((transaction) => transaction.event_type.startsWith("payout_"));
  }

  if (filter === "platform_fees") {
    return transactions.filter(
      (transaction) =>
        transaction.event_type === "payment_completed" ||
        transaction.event_type === "payout_completed",
    );
  }

  return transactions;
}

export default async function EarningsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const resolvedSearchParams = await searchParams;
  const transactionFilter = getSingleValue(resolvedSearchParams.filter) ?? "all";

  await reconcileMissingPayoutsForLister(user.id);

  const [summary, transactions, profileResult, payoutsResult, availableBalanceResult] =
    await Promise.all([
      getEarningsSummary(user.id),
      getTransactionsForLister(user.id),
      supabase
        .from("profiles")
        .select(
          `
            id,
            payout_method,
            bank_name,
            bank_account_name,
            bank_account_number,
            bank_kyc_verified,
            gcash_phone_number,
            maya_phone_number,
            payout_setup_completed
          `,
        )
        .eq("id", user.id)
        .maybeSingle<Profile>(),
      supabase
        .from("payouts")
        .select("*, booking:bookings!payouts_booking_id_fkey(id)")
        .eq("lister_id", user.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("bookings")
        .select("lister_payout")
        .eq("lister_id", user.id)
        .in("status", ["confirmed", "active", "returned"]),
    ]);

  const profile = profileResult.data;
  const payouts = ((payoutsResult.data ?? []) as EarningsPayoutRow[]) ?? [];
  const pendingPayouts = payouts.filter((payout) =>
    payout.status === "pending" || payout.status === "processing",
  );
  const failedPayouts = payouts.filter((payout) => payout.status === "failed");
  const transactionsForView = filterTransactions(transactions, transactionFilter);
  const availableBalance = ((availableBalanceResult.data ?? []) as Array<{ lister_payout: number | null }>).reduce(
    (sum, booking) => sum + (booking.lister_payout ?? 0),
    0,
  );

  const MethodIcon = getMethodIcon(profile?.payout_method);

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Earnings</h1>
        <p className="text-sm text-muted-foreground">
          Track payouts, fee flow, and what is still held until rentals complete.
        </p>
      </div>

      <section className="rounded-[28px] border border-brand-navy/10 bg-gradient-to-br from-[#003e86] to-[#0b5fa8] p-6 text-white shadow-sm">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="rounded-2xl bg-white/10 p-3">
              <MethodIcon className="size-5 text-[#38bdf2]" />
            </div>
            <div className="space-y-3">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-white/65">Payout method</p>
                <p className="mt-1 text-xl font-semibold">
                  {profile?.payout_method ? profile.payout_method.toUpperCase() : "Not set up"}
                </p>
              </div>
              {profile?.payout_method ? (
                <PayoutDetailsDisplay
                  className="md:grid-cols-1"
                  masked
                  payoutDetails={{
                    method: profile.payout_method,
                    bank_name: profile.bank_name ?? undefined,
                    bank_account_name: profile.bank_account_name ?? undefined,
                    bank_account_number: profile.bank_account_number ?? undefined,
                    bank_kyc_verified: profile.bank_kyc_verified ?? undefined,
                    gcash_phone_number: profile.gcash_phone_number ?? undefined,
                    maya_phone_number: profile.maya_phone_number ?? undefined,
                  }}
                />
              ) : (
                <p className="text-sm text-white/75">
                  Add a payout method so we can release funds as soon as bookings complete.
                </p>
              )}
            </div>
          </div>

          <Button asChild className="bg-white text-brand-navy hover:bg-slate-100">
            <Link href="/dashboard/settings/payments">Manage Payout Settings</Link>
          </Button>
        </div>

        {profile?.payout_method === "bank" && !profile.bank_kyc_verified ? (
          <div className="mt-5 rounded-2xl border border-amber-200/40 bg-amber-100/10 p-4 text-sm text-amber-50">
            KYC pending — payouts will start once verified.
          </div>
        ) : null}
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-3xl border border-border/70 bg-white p-5 shadow-sm">
          <p className="text-sm text-muted-foreground">Total Earned</p>
          <p className="mt-2 text-3xl font-semibold text-brand-navy">
            {formatCurrency(summary.totalEarned, "SGD")}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Completed payouts only
          </p>
        </div>
        <div className="rounded-3xl border border-border/70 bg-white p-5 shadow-sm">
          <p className="text-sm text-muted-foreground">This Month Earned</p>
          <p className="mt-2 text-3xl font-semibold text-brand-navy">
            {formatCurrency(summary.thisMonthEarned, "SGD")}
          </p>
        </div>
        <div className="rounded-3xl border border-border/70 bg-white p-5 shadow-sm">
          <p className="text-sm text-muted-foreground">Pending Payouts</p>
          <p className="mt-2 text-3xl font-semibold text-brand-navy">
            {summary.pendingPayouts}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            {formatCurrency(summary.pendingPayoutsAmount, "SGD")}
          </p>
        </div>
        <div className="rounded-3xl border border-border/70 bg-white p-5 shadow-sm">
          <p className="text-sm text-muted-foreground">Available Balance</p>
          <p className="mt-2 text-3xl font-semibold text-brand-navy">
            {formatCurrency(availableBalance, "SGD")}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Held until rental completes and is verified
          </p>
        </div>
      </section>

      {pendingPayouts.length > 0 ? (
        <section className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Pending Payouts</h2>
            <p className="text-sm text-muted-foreground">
              These will be processed once the rental is completed and verified.
            </p>
          </div>
          <div className="grid gap-4 xl:grid-cols-2">
            {pendingPayouts.map((payout) => (
              <PayoutStatusCard key={payout.id} payout={payout} />
            ))}
          </div>
        </section>
      ) : null}

      {failedPayouts.length > 0 ? (
        <section className="space-y-4">
          <div className="flex items-center gap-2 text-rose-700">
            <AlertTriangle className="size-4" />
            <h2 className="text-lg font-semibold">Failed Payouts</h2>
          </div>
          <div className="grid gap-4 xl:grid-cols-2">
            {failedPayouts.map((payout) => (
              <PayoutStatusCard key={payout.id} payout={payout} />
            ))}
          </div>
        </section>
      ) : null}

      <section className="space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Recent Transactions</h2>
            <p className="text-sm text-muted-foreground">
              Review platform intake, payout release, and fee-related movements.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 rounded-2xl border border-border/70 bg-white p-2">
            {[
              { key: "all", label: "All" },
              { key: "payouts", label: "Payouts" },
              { key: "platform_fees", label: "Platform Fees" },
            ].map((filter) => (
              <Button
                asChild
                className={transactionFilter === filter.key ? "bg-brand-navy text-white hover:bg-brand-steel" : ""}
                key={filter.key}
                size="sm"
                variant={transactionFilter === filter.key ? "default" : "ghost"}
              >
                <Link href={`/dashboard/earnings?filter=${filter.key}`}>{filter.label}</Link>
              </Button>
            ))}
          </div>
        </div>
        <TransactionList showBookingRef transactions={transactionsForView} />
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Payout History</h2>
            <p className="text-sm text-muted-foreground">
              Full release history with booking references and payout methods.
            </p>
          </div>
          <Button type="button" variant="outline">
            <Download className="size-4" />
            Export
          </Button>
        </div>

        <div className="overflow-hidden rounded-3xl border border-border/70 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Booking</th>
                <th className="px-4 py-3 font-medium">Amount</th>
                <th className="px-4 py-3 font-medium">Method</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Reference</th>
              </tr>
            </thead>
            <tbody>
              {payouts.length === 0 ? (
                <tr>
                  <td className="px-4 py-10 text-center text-muted-foreground" colSpan={6}>
                    No payouts yet.
                  </td>
                </tr>
              ) : (
                payouts.map((payout) => (
                  <tr className="border-t border-border/70" key={payout.id}>
                    <td className="px-4 py-3">{formatDate(payout.created_at)}</td>
                    <td className="px-4 py-3">{payout.booking_id?.slice(0, 8) ?? "-"}</td>
                    <td className="px-4 py-3 font-semibold text-brand-navy">
                      {formatCurrency(payout.amount, payout.currency)}
                    </td>
                    <td className="px-4 py-3 capitalize">{payout.payout_method ?? "manual"}</td>
                    <td className="px-4 py-3">
                      <Badge
                        className={
                          payout.status === "completed"
                            ? "bg-emerald-100 text-emerald-900"
                            : payout.status === "failed"
                              ? "bg-rose-100 text-rose-900"
                              : "bg-amber-100 text-amber-900"
                        }
                      >
                        {payout.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {payout.reference_number ?? "-"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
