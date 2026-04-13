import Link from "next/link";
import { AlertTriangle, CheckCircle2, Download } from "lucide-react";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { PayoutFailDialog } from "@/components/admin/payout-fail-dialog";
import { PayoutProcessDialog } from "@/components/admin/payout-process-dialog";
import { PayoutDetailsDisplay } from "@/components/payout/payout-details-display";
import { PayoutMethodBadge } from "@/components/payout/payout-method-badge";
import { PayoutStatusCard } from "@/components/payments/payout-status-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { Booking, Payout, Profile } from "@/types";

type AdminPayoutRow = Payout & {
  lister: Profile;
  booking: Booking | null;
};

export default async function AdminPayoutsPage() {
  const admin = createAdminClient();
  const { data } = await admin
    .from("payouts")
    .select(
      `
        *,
        lister:profiles!payouts_lister_id_fkey(*),
        booking:bookings!payouts_booking_id_fkey(*)
      `,
    )
    .order("created_at", { ascending: false });

  const payouts = ((data ?? []) as AdminPayoutRow[]) ?? [];
  const failedPayouts = payouts.filter((payout) => payout.status === "failed");
  const pendingPayouts = payouts.filter(
    (payout) => payout.status === "pending" || payout.status === "processing",
  );
  const totalPendingAmount = pendingPayouts.reduce((sum, payout) => sum + payout.amount, 0);
  const totalPaidOut = payouts
    .filter((payout) => payout.status === "completed")
    .reduce((sum, payout) => sum + payout.amount, 0);

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Payouts"
        description="Review failed releases first, then process the next batch of lister payouts."
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-3xl border border-border/70 bg-white p-5 shadow-sm">
          <p className="text-sm text-muted-foreground">Total pending</p>
          <p className="mt-2 text-3xl font-semibold text-brand-navy">
            {pendingPayouts.length}
          </p>
        </div>
        <div className="rounded-3xl border border-border/70 bg-white p-5 shadow-sm">
          <p className="text-sm text-muted-foreground">Total amount pending</p>
          <p className="mt-2 text-3xl font-semibold text-brand-navy">
            {formatCurrency(totalPendingAmount)}
          </p>
        </div>
        <div className="rounded-3xl border border-border/70 bg-white p-5 shadow-sm">
          <p className="text-sm text-muted-foreground">Total paid out</p>
          <p className="mt-2 text-3xl font-semibold text-brand-navy">
            {formatCurrency(totalPaidOut)}
          </p>
        </div>
        <div className="rounded-3xl border border-rose-200 bg-rose-50 p-5 shadow-sm">
          <p className="text-sm text-rose-700">Failed payouts</p>
          <p className="mt-2 text-3xl font-semibold text-rose-700">
            {failedPayouts.length}
          </p>
        </div>
      </div>

      {failedPayouts.length > 0 ? (
        <section className="space-y-4">
          <div className="flex items-center gap-2 text-rose-700">
            <AlertTriangle className="size-4" />
            <h2 className="text-lg font-semibold">Failed Payouts</h2>
            <Badge className="bg-rose-600 text-white hover:bg-rose-600">
              Urgent
            </Badge>
          </div>
          <div className="grid gap-4">
            {failedPayouts.map((payout) => {
              const listerName =
                payout.lister.display_name || payout.lister.full_name || payout.lister.email;

              return (
                <div
                  className="rounded-3xl border border-rose-200 bg-white p-5 shadow-sm"
                  key={payout.id}
                >
                  <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                    <div className="space-y-3">
                      <div>
                        <p className="text-lg font-semibold text-foreground">{listerName}</p>
                        <p className="text-sm text-muted-foreground">
                          {formatCurrency(payout.amount, payout.currency)} via {payout.payout_method ?? "manual"} · {formatDate(payout.updated_at)}
                        </p>
                      </div>
                      <p className="text-sm text-rose-700">
                        Reason: {payout.failure_reason ?? "No failure reason recorded."}
                      </p>
                      {payout.payout_method ? (
                        <PayoutDetailsDisplay
                          masked={false}
                          payoutDetails={{
                            method: payout.payout_method as "bank" | "gcash" | "maya",
                            bank_name: payout.lister.bank_name ?? undefined,
                            bank_account_name: payout.lister.bank_account_name ?? undefined,
                            bank_account_number: payout.lister.bank_account_number ?? undefined,
                            gcash_phone_number: payout.lister.gcash_phone_number ?? undefined,
                            maya_phone_number: payout.lister.maya_phone_number ?? undefined,
                          }}
                          showCopyButtons
                        />
                      ) : null}
                    </div>
                    <div className="flex flex-wrap gap-3">
                      <PayoutProcessDialog
                        onComplete={() => {}}
                        payout={payout}
                        trigger={
                          <Button className="bg-brand-navy text-white hover:bg-brand-steel">
                            Process Manually
                          </Button>
                        }
                      />
                      <Button asChild variant="outline">
                        <Link href={`/admin/bookings/${payout.booking_id}`}>Mark Resolved</Link>
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Pending Payouts</h2>
            <p className="text-sm text-muted-foreground">
              Review the payout destination before triggering release.
            </p>
          </div>
          <Button type="button" variant="outline">
            <Download className="size-4" />
            Export
          </Button>
        </div>

        <div className="grid gap-4">
          {pendingPayouts.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-border/70 bg-slate-50 px-6 py-10 text-center">
              <p className="font-medium text-foreground">No pending payouts</p>
            </div>
          ) : (
            pendingPayouts.map((payout) => {
              const listerName =
                payout.lister.display_name || payout.lister.full_name || payout.lister.email;
              return (
                <div
                  className="rounded-3xl border border-border/70 bg-white p-5 shadow-sm"
                  key={payout.id}
                >
                  <div className="grid gap-5 xl:grid-cols-[1.2fr_1fr_auto]">
                    <div className="space-y-3">
                      <div>
                        <p className="text-lg font-semibold text-foreground">{listerName}</p>
                        <p className="text-sm text-muted-foreground">
                          Booking {payout.booking_id?.slice(0, 8) ?? "-"} · Created {formatDate(payout.created_at)}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-3">
                        <p className="text-xl font-semibold text-brand-navy">
                          {formatCurrency(payout.amount, payout.currency)}
                        </p>
                        {payout.payout_method ? (
                          <PayoutMethodBadge
                            method={payout.payout_method as "bank" | "gcash" | "maya"}
                            size="sm"
                          />
                        ) : null}
                      </div>
                    </div>

                    <PayoutDetailsDisplay
                      masked={false}
                      payoutDetails={{
                        method: (payout.payout_method ?? "bank") as "bank" | "gcash" | "maya",
                        bank_name: payout.lister.bank_name ?? undefined,
                        bank_account_name: payout.lister.bank_account_name ?? undefined,
                        bank_account_number: payout.lister.bank_account_number ?? undefined,
                        gcash_phone_number: payout.lister.gcash_phone_number ?? undefined,
                        maya_phone_number: payout.lister.maya_phone_number ?? undefined,
                      }}
                      showCopyButtons
                    />

                    <div className="flex flex-col gap-3">
                      <PayoutProcessDialog
                        onComplete={() => {}}
                        payout={payout}
                        trigger={
                          <Button className="bg-brand-navy text-white hover:bg-brand-steel">
                            Process
                          </Button>
                        }
                      />
                      <PayoutFailDialog
                        onComplete={() => {}}
                        payout={payout}
                        trigger={<Button variant="outline">Reject</Button>}
                      />
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">All payouts</h2>
          <p className="text-sm text-muted-foreground">
            Latest payout state across the platform.
          </p>
        </div>
        <div className="grid gap-4 xl:grid-cols-2">
          {payouts.slice(0, 8).map((payout) => (
            <PayoutStatusCard key={payout.id} payout={payout} />
          ))}
        </div>
      </section>
    </div>
  );
}
