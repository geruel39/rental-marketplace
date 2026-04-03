"use client";

import { useEffect, useMemo, useState } from "react";
import {
  differenceInMilliseconds,
  formatDistanceStrict,
  isAfter,
  isBefore,
} from "date-fns";

import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface RentalCountdownProps {
  rentalEndsAt: string;
  rentalStartedAt: string;
  variant?: "compact" | "full";
}

export function RentalCountdown({
  rentalEndsAt,
  rentalStartedAt,
  variant = "full",
}: RentalCountdownProps) {
  const [now, setNow] = useState(() => Date.now());
  const endDate = useMemo(() => new Date(rentalEndsAt), [rentalEndsAt]);
  const startDate = useMemo(() => new Date(rentalStartedAt), [rentalStartedAt]);

  useEffect(() => {
    const id = window.setInterval(() => {
      setNow(Date.now());
    }, 60_000);
    return () => window.clearInterval(id);
  }, []);

  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return <p className="text-sm text-muted-foreground">Rental countdown unavailable</p>;
  }

  const nowDate = new Date(now);
  if (isBefore(nowDate, startDate)) {
    return <p className="text-sm text-muted-foreground">Rental has not started yet</p>;
  }

  const totalMs = Math.max(1, differenceInMilliseconds(endDate, startDate));
  const elapsedMs = Math.max(0, differenceInMilliseconds(nowDate, startDate));
  const remainingMs = differenceInMilliseconds(endDate, nowDate);
  const progress = Math.min(100, Math.max(0, (elapsedMs / totalMs) * 100));
  const remainingRatio = Math.max(0, remainingMs / totalMs);
  const isOverdue = isAfter(nowDate, endDate);
  const warning = !isOverdue && remainingRatio < 0.1;

  const remainingLabel = isOverdue
    ? `OVERDUE by ${formatDistanceStrict(nowDate, endDate)}`
    : `Time remaining: ${formatDistanceStrict(endDate, nowDate)}`;

  return (
    <div className={cn("space-y-2", variant === "compact" && "space-y-1")}>
      {variant === "full" ? (
        <p className="text-sm font-medium text-brand-navy">Rental Progress</p>
      ) : null}

      <Progress
        className={cn(
          "h-2 bg-brand-light",
          warning && "bg-yellow-100",
          isOverdue && "bg-red-100",
          "[&_[data-slot=progress-indicator]]:bg-brand-sky",
          warning && "[&_[data-slot=progress-indicator]]:bg-yellow-500",
          isOverdue && "[&_[data-slot=progress-indicator]]:bg-red-500",
        )}
        value={isOverdue ? 100 : progress}
      />

      <p
        className={cn(
          variant === "compact" ? "text-xs" : "text-sm",
          "font-mono font-medium text-brand-navy",
          warning && "text-yellow-700",
          isOverdue && "text-red-700",
        )}
      >
        {isOverdue ? `⚠ ${remainingLabel}` : remainingLabel}
      </p>
    </div>
  );
}
