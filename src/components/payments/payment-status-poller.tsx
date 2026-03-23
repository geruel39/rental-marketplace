"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

interface PaymentStatusPollerProps {
  enabled: boolean;
}

export function PaymentStatusPoller({ enabled }: PaymentStatusPollerProps) {
  const router = useRouter();

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const timeout = window.setTimeout(() => {
      router.refresh();
    }, 3000);

    return () => window.clearTimeout(timeout);
  }, [enabled, router]);

  return null;
}
