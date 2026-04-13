import Link from "next/link";

import { getFeeConfig } from "@/actions/payments";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function formatPercent(value: number) {
  return `${(value * 100).toFixed(1).replace(/\.0$/, "")}%`;
}

export default async function FeesPage() {
  const fees = await getFeeConfig();

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f4f9ff_0%,#ffffff_42%,#eef8ff_100%)]">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-14 sm:px-6 lg:px-8">
        <div className="space-y-4">
          <Badge className="bg-brand-sky text-brand-navy hover:bg-brand-sky">Fee Disclosure</Badge>
          <div className="space-y-3">
            <h1 className="text-4xl font-semibold tracking-tight text-brand-navy">
              Simple, transparent marketplace fees
            </h1>
            <p className="max-w-3xl text-base text-slate-600">
              Every booking shows the full breakdown before payment. This page explains
              what renters pay, what listers receive, and when payouts are released.
            </p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card className="border-brand-navy/10 shadow-sm">
            <CardHeader>
              <CardTitle className="text-brand-navy">Renter service fee</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold text-brand-navy">
                {formatPercent(fees.platform_service_fee_renter)}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                Added at checkout to support payments, booking protection, and support.
              </p>
            </CardContent>
          </Card>
          <Card className="border-brand-navy/10 shadow-sm">
            <CardHeader>
              <CardTitle className="text-brand-navy">Lister service fee</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold text-brand-navy">
                {formatPercent(fees.platform_service_fee_lister)}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                Deducted from the rental amount before payout to cover platform operations.
              </p>
            </CardContent>
          </Card>
          <Card className="border-brand-navy/10 shadow-sm">
            <CardHeader>
              <CardTitle className="text-brand-navy">HitPay processing</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold text-brand-navy">3.4% + SGD 0.50</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Payment processing charged by HitPay on each transaction.
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <Card className="border-brand-navy/10 shadow-sm">
            <CardHeader>
              <CardTitle className="text-brand-navy">Cancellation policies</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-slate-600">
              <div>
                <p className="font-medium text-brand-navy">Flexible</p>
                <p>
                  Full refund if cancelled within {fees.cancellation_flexible_full_refund_hours}{" "}
                  hours of booking confirmation, then partial refund rules may apply.
                </p>
              </div>
              <div>
                <p className="font-medium text-brand-navy">Moderate</p>
                <p>
                  Full refund if cancelled within {fees.cancellation_moderate_full_refund_hours}{" "}
                  hours, then a reduced refund may apply closer to the rental start.
                </p>
              </div>
              <div>
                <p className="font-medium text-brand-navy">Strict</p>
                <p>
                  Full refund if cancelled within {fees.cancellation_strict_full_refund_hours}{" "}
                  hours, with stricter reductions after that window.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-brand-navy/10 shadow-sm">
            <CardHeader>
              <CardTitle className="text-brand-navy">Payout timeline</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-600">
              <p>
                Lister payouts are released within {fees.payout_delay_days} day
                {fees.payout_delay_days === 1 ? "" : "s"} after rental completion and final
                verification.
              </p>
              <p>
                If a dispute, payout setup issue, or deposit review is open, funds stay on hold
                until the issue is resolved.
              </p>
              <p>
                Questions before booking? Review the payment summary in the booking widget or{" "}
                <Link className="font-medium text-brand-navy underline underline-offset-4" href="/dashboard">
                  contact support from your dashboard
                </Link>
                .
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
