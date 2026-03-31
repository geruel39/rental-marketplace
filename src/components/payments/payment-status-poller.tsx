"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface PaymentStatusPollerProps {
  enabled: boolean;
  fallbackMessage?: string;
}

export function PaymentStatusPoller({
  enabled,
  fallbackMessage,
}: PaymentStatusPollerProps) {
  const router = useRouter();
  const [attempts, setAttempts] = useState(0);
  const MAX_ATTEMPTS = 10; // Stop polling after 10 attempts (30 seconds)

  console.log("[POLLER] Poller enabled:", enabled, "Attempts:", attempts);

  useEffect(() => {
    if (!enabled || attempts >= MAX_ATTEMPTS) {
      console.log("[POLLER] Poller disabled or max attempts reached");
      return;
    }

    console.log("[POLLER] Starting refresh timeout (3s)");
    const timeout = window.setTimeout(() => {
      console.log("[POLLER] Refreshing page, attempt:", attempts + 1);
      setAttempts((prev) => prev + 1);
      router.refresh();
    }, 3000);

    return () => {
      console.log("[POLLER] Clearing timeout");
      window.clearTimeout(timeout);
    };
  }, [enabled, router, attempts]);

  if (!enabled || attempts < MAX_ATTEMPTS || !fallbackMessage) {
    return null;
  }

  return (
    <p className="text-center text-sm text-muted-foreground">
      {fallbackMessage}
    </p>
  );
}
