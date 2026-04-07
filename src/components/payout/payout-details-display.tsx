"use client";

import { Copy, Phone } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { cn, formatPhoneNumber, maskAccountNumber } from "@/lib/utils";
import type { PayoutMethodDetails } from "@/types";

type PayoutDetailsDisplayProps = {
  payoutDetails: PayoutMethodDetails;
  masked?: boolean;
  showCopyButtons?: boolean;
  className?: string;
};

function maskPhoneNumber(phone: string) {
  const digits = phone.replace(/\D/g, "");
  let normalized = digits;

  if (normalized.startsWith("0")) {
    normalized = `63${normalized.slice(1)}`;
  } else if (!normalized.startsWith("63")) {
    normalized = `63${normalized}`;
  }

  const local = normalized.slice(-10);
  const first = local.slice(0, 3);
  const last = local.slice(-2);

  return `+63 ${first} *** **${last}`;
}

function DisplayRow({
  label,
  value,
  showCopyButton,
}: {
  label: string;
  value: string;
  showCopyButton?: boolean;
}) {
  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copied`);
    } catch {
      toast.error("Could not copy to clipboard");
    }
  }

  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-brand-navy/10 bg-white p-4 text-sm">
      <div className="space-y-1">
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-brand-navy">
          {label}
        </p>
        <p className="font-medium text-foreground">{value}</p>
      </div>
      {showCopyButton ? (
        <Button
          className="border-brand-navy text-brand-navy hover:bg-brand-light"
          onClick={() => void handleCopy()}
          size="icon-sm"
          type="button"
          variant="outline"
        >
          <Copy className="size-4" />
        </Button>
      ) : null}
    </div>
  );
}

export function PayoutDetailsDisplay({
  payoutDetails,
  masked = true,
  showCopyButtons = false,
  className,
}: PayoutDetailsDisplayProps) {
  if (payoutDetails.method === "bank") {
    return (
      <div className={cn("grid gap-3 md:grid-cols-3", className)}>
        <DisplayRow
          label="Bank Name"
          showCopyButton={showCopyButtons}
          value={payoutDetails.bank_name || "Not provided"}
        />
        <DisplayRow
          label="Account Number"
          showCopyButton={showCopyButtons && Boolean(payoutDetails.bank_account_number)}
          value={
            payoutDetails.bank_account_number
              ? masked
                ? maskAccountNumber(payoutDetails.bank_account_number)
                : payoutDetails.bank_account_number
              : "Not provided"
          }
        />
        <DisplayRow
          label="Account Name"
          showCopyButton={showCopyButtons && Boolean(payoutDetails.bank_account_name)}
          value={payoutDetails.bank_account_name || "Not provided"}
        />
      </div>
    );
  }

  const phone =
    payoutDetails.method === "gcash"
      ? payoutDetails.gcash_phone_number
      : payoutDetails.maya_phone_number;

  return (
    <div className={cn("grid gap-3", className)}>
      <DisplayRow
        label={payoutDetails.method === "gcash" ? "GCash Number" : "Maya Number"}
        showCopyButton={showCopyButtons && Boolean(phone)}
        value={
          phone
            ? masked
              ? maskPhoneNumber(phone)
              : formatPhoneNumber(phone)
            : "Not provided"
        }
      />
      {!masked && phone ? (
        <p className="flex items-center gap-2 px-1 text-xs text-muted-foreground">
          <Phone className="size-3.5" />
          Use the exact registered mobile number when processing wallet payouts.
        </p>
      ) : null}
    </div>
  );
}
