import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { redirect } from "next/navigation";

import { getPayoutSetupStatus } from "@/actions/payout";
import { PayoutSettingsClient } from "@/components/payout/payout-settings-client";
import { Pagination } from "@/components/shared/pagination";
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
import { formatCurrency, formatDate, getPayoutMethodLabel } from "@/lib/utils";
import type { Payout, Profile } from "@/types";

type SearchParams = {
  page?: string;
};

const PAYOUTS_PER_PAGE = 10;

export default async function PaymentsSettingsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const resolvedSearchParams = await searchParams;
  const currentPage = Math.max(1, Number(resolvedSearchParams.page) || 1);
  const from = (currentPage - 1) * PAYOUTS_PER_PAGE;
  const to = from + PAYOUTS_PER_PAGE - 1;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [{ data: profile }, payoutStatus, payoutsResult] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle<Profile>(),
    getPayoutSetupStatus(user.id),
    supabase
      .from("payouts")
      .select("*", { count: "exact" })
      .eq("lister_id", user.id)
      .eq("status", "completed")
      .order("created_at", { ascending: false })
      .range(from, to),
  ]);

  if (!profile) {
    redirect("/dashboard/settings");
  }

  const payouts = (payoutsResult.data ?? []) as Payout[];
  const totalCount = payoutsResult.count ?? 0;
  const totalPages = totalCount === 0 ? 0 : Math.ceil(totalCount / PAYOUTS_PER_PAGE);

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold tracking-tight text-brand-navy">
              Payout Settings
            </h1>
            <p className="text-sm text-muted-foreground">
              Choose how you want to receive earnings and complete any verification steps.
            </p>
          </div>

          {payoutStatus.is_complete ? (
            <Badge className="bg-emerald-100 px-3 py-1 text-emerald-700 hover:bg-emerald-100">
              <CheckCircle2 className="mr-1 size-4" />
              Setup Complete
            </Badge>
          ) : (
            <Badge className="bg-amber-100 px-3 py-1 text-amber-700 hover:bg-amber-100">
              <AlertTriangle className="mr-1 size-4" />
              Setup Required
            </Badge>
          )}
        </div>

        {!payoutStatus.is_complete ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            You must complete payout setup to create listings.
          </div>
        ) : null}

        <PayoutSettingsClient payoutStatus={payoutStatus} profile={profile} />
      </section>

      <section className="space-y-4">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold text-brand-navy">Recent Payouts</h2>
          <p className="text-sm text-muted-foreground">
            Track your latest completed payout transfers.
          </p>
        </div>

        <div className="rounded-3xl border border-border/70 bg-white p-4 shadow-sm">
          {payouts.length === 0 ? (
            <div className="flex min-h-48 items-center justify-center rounded-2xl border border-dashed border-border bg-brand-light/60 px-6 text-center text-sm text-muted-foreground">
              No payouts yet. Start renting out your items!
            </div>
          ) : (
            <div className="space-y-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payouts.map((payout) => (
                    <TableRow key={payout.id}>
                      <TableCell>{formatDate(payout.created_at)}</TableCell>
                      <TableCell>{formatCurrency(payout.amount, payout.currency)}</TableCell>
                      <TableCell>
                        {payout.payout_method
                          ? getPayoutMethodLabel(
                              payout.payout_method as "bank" | "gcash" | "maya",
                            )
                          : "Manual"}
                      </TableCell>
                      <TableCell>{payout.reference_number ?? "-"}</TableCell>
                      <TableCell>
                        <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
                          {payout.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <Pagination currentPage={currentPage} totalPages={totalPages} />
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
