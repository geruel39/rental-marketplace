"use client";

import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

interface PaymentCountdownProps {
  expiresAt: string;
}

function getRemaining(expiresAt: string, now: number) {
  const diff = new Date(expiresAt).getTime() - now;

  if (!Number.isFinite(diff) || diff <= 0) {
    return { expired: true, hours: 0, minutes: 0 };
  }

  const totalMinutes = Math.floor(diff / 60000);
  return {
    expired: false,
    hours: Math.floor(totalMinutes / 60),
    minutes: totalMinutes % 60,
  };
}

export function PaymentCountdown({ expiresAt }: PaymentCountdownProps) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNow(Date.now());
    }, 60000);

    return () => window.clearInterval(intervalId);
  }, []);

  const remaining = getRemaining(expiresAt, now);

  if (remaining.expired) {
    return <p className="text-sm font-medium text-destructive">Expired</p>;
  }

  const isUrgent = remaining.hours < 1;

  return (
    <p
      className={cn(
        "text-sm font-medium text-muted-foreground",
        isUrgent && "text-destructive",
      )}
    >
      Payment expires in: {remaining.hours}h {remaining.minutes}m
    </p>
  );
}
