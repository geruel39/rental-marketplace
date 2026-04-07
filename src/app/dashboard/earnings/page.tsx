import Link from "next/link";
import { AlertTriangle, CreditCard, Building, Smartphone, Wallet } from "lucide-react";
import { redirect } from "next/navigation";

import { getPayoutsForUser } from "@/actions/profile";
import { PayoutDetailsDisplay } from "@/components/payout/payout-details-display";
import { PayoutMethodBadge } from "@/components/payout/payout-method-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import type { Profile } from "@/types";

export default async function EarningsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [payouts, profileResult] = await Promise.all([
    getPayoutsForUser(user.id),
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle<Profile>(),
  ]);
  const profile = profileResult.data;
  const totalEarned = payouts.reduce((sum, payout) => sum + payout.amount, 0);
  const pendingPayouts = payouts.filter((payout) => payout.status !== "completed");
  const completedPayouts = payouts.filter((payout) => payout.status === "completed");
  const currentMethod = profile?.payout_method;

  function getMethodIcon() {
    switch (currentMethod) {
      case "bank":
        return Building;
      case "gcash":
        return Smartphone;
      case "maya":
        return CreditCard;
      default:
        return Wallet;
    }
  }

  const MethodIcon = getMethodIcon();

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Earnings</h1>
        <p className="text-sm text-muted-foreground">
          Track lister payouts and see when completed bookings turn into earnings.
        </p>
      </div>

      {currentMethod ? (
        <div className="rounded-3xl border border-border bg-background p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex items-start gap-4">
              <div className="rounded-2xl bg-brand-light p-3">
                <MethodIcon className="size-5 text-brand-steel" />
              </div>
              <div className="space-y-3">
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Payout Method</p>
                  <PayoutMethodBadge method={currentMethod} />
                </div>
                <PayoutDetailsDisplay
                  masked
                  payoutDetails={{
                    method: currentMethod,
                    bank_name: profile?.bank_name ?? undefined,
                    bank_account_name: profile?.bank_account_name ?? undefined,
                    bank_account_number: profile?.bank_account_number ?? undefined,
                    bank_kyc_verified: profile?.bank_kyc_verified ?? undefined,
                    gcash_phone_number: profile?.gcash_phone_number ?? undefined,
                    maya_phone_number: profile?.maya_phone_number ?? undefined,
                  }}
                />
              </div>
            </div>

            <Button asChild className="border-brand-navy text-brand-navy hover:bg-brand-light" variant="outline">
              <Link href="/dashboard/settings/payments">Change Method</Link>
            </Button>
          </div>
        </div>
      ) : null}

      {currentMethod === "bank" && !profile?.bank_kyc_verified ? (
        <Alert className="border-amber-200 bg-amber-50 text-amber-900">
          <AlertTriangle className="size-4 text-amber-700" />
          <AlertDescription>
            Your KYC is pending verification. Payouts will be processed once verified.
          </AlertDescription>
        </Alert>
      ) : null}

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
                <TableHead>Reference</TableHead>
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
                  <TableCell>
                    {payout.payout_method ? (
                      <PayoutMethodBadge
                        method={payout.payout_method as "bank" | "gcash" | "maya"}
                        size="sm"
                      />
                    ) : (
                      "Manual"
                    )}
                  </TableCell>
                  <TableCell>{payout.reference_number ?? "-"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
