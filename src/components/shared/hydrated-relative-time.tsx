"use client";

import { useSyncExternalStore } from "react";

import { formatDate, formatRelativeTime } from "@/lib/utils";

function subscribe() {
  return () => undefined;
}

export function HydratedRelativeTime({
  value,
  className,
}: {
  value: string | Date;
  className?: string;
}) {
  const isHydrated = useSyncExternalStore(subscribe, () => true, () => false);

  return (
    <span className={className} suppressHydrationWarning>
      {isHydrated ? formatRelativeTime(value) : formatDate(value)}
    </span>
  );
}
