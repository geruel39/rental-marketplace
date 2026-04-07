"use client";

import {
  Building,
  CheckCircle2,
  CreditCard,
  Smartphone,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { PayoutMethod } from "@/types";

type PayoutMethodSelectorProps = {
  currentMethod?: PayoutMethod;
  onSelect: (method: PayoutMethod) => void;
};

const payoutOptions: Array<{
  method: PayoutMethod;
  title: string;
  description: string;
  badge: string;
  Icon: typeof Building;
}> = [
  {
    method: "bank",
    title: "Bank Account",
    description: "Direct bank transfer",
    badge: "KYC Required",
    Icon: Building,
  },
  {
    method: "gcash",
    title: "GCash",
    description: "Mobile wallet",
    badge: "Instant Setup",
    Icon: Smartphone,
  },
  {
    method: "maya",
    title: "Maya",
    description: "Mobile wallet",
    badge: "Instant Setup",
    Icon: CreditCard,
  },
];

export function PayoutMethodSelector({
  currentMethod,
  onSelect,
}: PayoutMethodSelectorProps) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {payoutOptions.map(({ method, title, description, badge, Icon }) => {
        const isSelected = currentMethod === method;

        return (
          <button
            key={method}
            className={cn(
              "relative flex min-h-48 flex-col items-start justify-between rounded-3xl border border-border/70 bg-white p-6 text-left shadow-sm transition-all duration-200 hover:border-brand-sky hover:shadow-md",
              isSelected && "border-brand-navy bg-brand-navy/5 shadow-md",
            )}
            onClick={() => onSelect(method)}
            type="button"
          >
            <div className="flex w-full items-start justify-between gap-4">
              <div className="flex size-12 items-center justify-center rounded-2xl bg-brand-light text-brand-steel">
                <Icon className="size-6" />
              </div>
              {isSelected ? (
                <CheckCircle2 className="size-5 text-brand-sky" />
              ) : null}
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <h3 className="text-lg font-semibold text-brand-navy">{title}</h3>
                <p className="text-sm text-muted-foreground">{description}</p>
              </div>
              <Badge
                className={cn(
                  "border border-transparent bg-brand-light text-brand-steel hover:bg-brand-light",
                  isSelected && "border-brand-sky/30 bg-brand-sky/10 text-brand-navy",
                )}
                variant="secondary"
              >
                {badge}
              </Badge>
            </div>
          </button>
        );
      })}
    </div>
  );
}
