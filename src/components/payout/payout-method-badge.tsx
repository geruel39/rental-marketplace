import { Building, CreditCard, Smartphone } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn, getPayoutMethodLabel } from "@/lib/utils";
import type { PayoutMethod } from "@/types";

type PayoutMethodBadgeProps = {
  method: PayoutMethod;
  size?: "sm" | "md";
};

const tones: Record<PayoutMethod, string> = {
  bank: "bg-sky-100 text-sky-800 hover:bg-sky-100",
  gcash: "bg-brand-navy/10 text-brand-navy hover:bg-brand-navy/10",
  maya: "bg-brand-steel/10 text-brand-steel hover:bg-brand-steel/10",
};

function getIcon(method: PayoutMethod) {
  switch (method) {
    case "bank":
      return Building;
    case "gcash":
      return Smartphone;
    case "maya":
      return CreditCard;
  }
}

export function PayoutMethodBadge({
  method,
  size = "md",
}: PayoutMethodBadgeProps) {
  const Icon = getIcon(method);

  return (
    <Badge
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full",
        size === "sm" ? "px-2 py-0.5 text-xs" : "px-3 py-1 text-sm",
        tones[method],
      )}
    >
      <Icon className={size === "sm" ? "size-3.5" : "size-4"} />
      {getPayoutMethodLabel(method)}
    </Badge>
  );
}
