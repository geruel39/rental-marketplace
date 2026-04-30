"use client";

import {
  AlertTriangle,
  CheckCircle,
  CheckCircle2,
  Clock,
  CreditCard,
  Play,
  RotateCcw,
  XCircle,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { BOOKING_STATUS_CONFIG } from "@/types";
import type { BookingStatus } from "@/types";

interface BookingStatusBadgeProps {
  size?: "sm" | "md";
  status: BookingStatus;
}

const iconMap = {
  AlertTriangle,
  CheckCircle,
  CheckCircle2,
  Clock,
  CreditCard,
  Play,
  RotateCcw,
  XCircle,
} as const;

export function BookingStatusBadge({
  size = "md",
  status,
}: BookingStatusBadgeProps) {
  const config = BOOKING_STATUS_CONFIG[status];
  const Icon = iconMap[config.icon as keyof typeof iconMap] ?? Clock;

  return (
    <Badge
      className={cn(
        "min-h-7 gap-1.5 rounded-xl border-0 capitalize shadow-none",
        config.color,
        size === "sm" ? "px-2.5 py-1 text-[11px] font-medium" : "px-3 py-1 text-xs font-medium",
      )}
      variant="secondary"
    >
      <Icon className={size === "sm" ? "size-3" : "size-3.5"} />
      {config.label}
    </Badge>
  );
}
