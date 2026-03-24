"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

interface PaymentStatusPollerProps {
  enabled: boolean;
}

export function PaymentStatusPoller({ enabled }: PaymentStatusPollerProps) {
  const router = useRouter();

  console.log("[POLLER] Poller enabled:", enabled);

  useEffect(() => {
    if (!enabled) {
      console.log("[POLLER] Poller disabled, not starting");
      return;
    }

    console.log("[POLLER] Starting refresh timeout (3s)");
    const timeout = window.setTimeout(() => {
      console.log("[POLLER] Refreshing page");
      router.refresh();
    }, 3000);

    return () => {
      console.log("[POLLER] Clearing timeout");
      window.clearTimeout(timeout);
    };
  }, [enabled, router]);

  return null;
}
