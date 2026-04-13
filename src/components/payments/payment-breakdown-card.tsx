"use client";

import { ChevronDown, Info } from "lucide-react";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn, formatCurrency } from "@/lib/utils";
import type { PaymentBreakdown, PricingPeriod } from "@/types";

type PaymentBreakdownCardProps = {
  breakdown: PaymentBreakdown;
  pricingPeriod: PricingPeriod;
  rentalUnits: number;
  quantity: number;
  viewer?: "renter" | "lister" | "admin";
  currency?: string;
  defaultOpen?: boolean;
};

function getPeriodLabel(period: PricingPeriod, rentalUnits: number) {
  return `${period}${rentalUnits === 1 ? "" : "s"}`;
}

function BreakdownRow({
  label,
  value,
  muted,
  tone = "default",
  tooltip,
}: {
  label: string;
  value: string;
  muted?: boolean;
  tone?: "default" | "positive" | "negative";
  tooltip?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 text-sm">
      <div className="flex items-center gap-2 text-muted-foreground">
        <span className={cn(!muted && "text-foreground")}>{label}</span>
        {tooltip ? (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  aria-label={tooltip}
                  className="inline-flex text-muted-foreground transition-colors hover:text-brand-navy"
                  type="button"
                >
                  <Info className="size-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top">{tooltip}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : null}
      </div>
      <span
        className={cn(
          "font-medium",
          tone === "default" && "text-brand-navy",
          tone === "positive" && "text-emerald-600",
          tone === "negative" && "text-rose-600",
        )}
      >
        {value}
      </span>
    </div>
  );
}

export function PaymentBreakdownCard({
  breakdown,
  pricingPeriod,
  rentalUnits,
  quantity,
  viewer = "renter",
  currency = "SGD",
  defaultOpen = false,
}: PaymentBreakdownCardProps) {
  const unitPrice =
    rentalUnits > 0 && quantity > 0
      ? breakdown.subtotal / rentalUnits / quantity
      : breakdown.subtotal;
  const periodLabel = getPeriodLabel(pricingPeriod, rentalUnits);
  const showRenter = viewer !== "lister";
  const showLister = viewer !== "renter";

  return (
    <details
      className="group rounded-3xl border border-border/70 bg-white shadow-sm"
      open={defaultOpen}
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-3xl px-5 py-4">
        <div>
          <p className="text-sm font-medium text-foreground">Payment breakdown</p>
          <p className="text-sm text-muted-foreground">
            Tap to {defaultOpen ? "hide" : "show"} fees, deposit, and payout details
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              {viewer === "lister" ? "Estimated payout" : "Total charged"}
            </p>
            <p className="text-lg font-semibold text-brand-navy">
              {formatCurrency(
                viewer === "lister"
                  ? breakdown.lister_payout
                  : breakdown.total_charged_to_renter,
                currency,
              )}
            </p>
          </div>
          <ChevronDown className="size-4 text-muted-foreground transition-transform group-open:rotate-180" />
        </div>
      </summary>

      <div className="space-y-5 border-t border-border/70 px-5 py-5">
        {showRenter ? (
          <section className="space-y-3 rounded-2xl bg-slate-50/70 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-navy">
              Renter Pays
            </p>
            <BreakdownRow
              label={`Base rental: ${formatCurrency(unitPrice, currency)} x ${rentalUnits} ${periodLabel} x ${quantity}`}
              value={formatCurrency(breakdown.subtotal, currency)}
            />
            <BreakdownRow
              label="Platform service fee (5%)"
              muted
              value={formatCurrency(breakdown.service_fee_renter, currency)}
            />
            <BreakdownRow
              label="Security deposit"
              muted
              tooltip="Security deposit is returned after item is inspected"
              value={formatCurrency(breakdown.deposit_amount, currency)}
            />
            <BreakdownRow
              label="HitPay processing fee"
              muted
              tooltip="HitPay charges 3.4% + SGD 0.50 per transaction"
              value={
                breakdown.platform_absorbs_hitpay
                  ? "Covered by platform"
                  : formatCurrency(breakdown.hitpay_fee, currency)
              }
            />
            <div className="border-t border-dashed border-border/70 pt-3">
              <BreakdownRow
                label="Total charged"
                value={formatCurrency(breakdown.total_charged_to_renter, currency)}
              />
            </div>
          </section>
        ) : null}

        {showLister ? (
          <section className="space-y-3 rounded-2xl bg-sky-50/50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-navy">
              Lister Receives
            </p>
            <BreakdownRow
              label="Rental amount"
              value={formatCurrency(breakdown.lister_gross, currency)}
            />
            <BreakdownRow
              label="Platform fee (-5%)"
              muted
              tone="negative"
              value={`-${formatCurrency(breakdown.service_fee_lister, currency)}`}
            />
            <div className="border-t border-dashed border-border/70 pt-3">
              <BreakdownRow
                label="Estimated payout"
                tone="positive"
                value={formatCurrency(breakdown.lister_payout, currency)}
              />
            </div>
          </section>
        ) : null}
      </div>
    </details>
  );
}
