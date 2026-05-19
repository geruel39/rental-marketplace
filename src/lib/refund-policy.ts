import type { PlatformFees } from "@/types";

type CancellationPolicy = "flexible" | "moderate" | "strict" | string | null | undefined;

const DEFAULT_FULL_REFUND_WINDOWS = {
  flexible: 24,
  moderate: 72,
  strict: 168,
} as const;

export function getFullRefundWindowHours(
  policy: CancellationPolicy,
  fees?: Partial<PlatformFees> | null,
) {
  switch (policy) {
    case "moderate":
      return (
        fees?.cancellation_moderate_full_refund_hours ??
        DEFAULT_FULL_REFUND_WINDOWS.moderate
      );
    case "strict":
      return (
        fees?.cancellation_strict_full_refund_hours ??
        DEFAULT_FULL_REFUND_WINDOWS.strict
      );
    case "flexible":
    default:
      return (
        fees?.cancellation_flexible_full_refund_hours ??
        DEFAULT_FULL_REFUND_WINDOWS.flexible
      );
  }
}

export function getPolicyLabel(policy: CancellationPolicy) {
  switch (policy) {
    case "moderate":
      return "moderate";
    case "strict":
      return "strict";
    case "flexible":
    default:
      return "flexible";
  }
}

export function describeRefundPolicy(
  policy: CancellationPolicy,
  fees?: Partial<PlatformFees> | null,
) {
  const windowHours = getFullRefundWindowHours(policy, fees);
  const label = getPolicyLabel(policy);

  if (label === "strict") {
    return `Strict policy: renter cancellations within ${windowHours} hours of payment refund the rental subtotal and deposit. Later renter cancellations refund the deposit only.`;
  }

  return `${label[0].toUpperCase()}${label.slice(
    1,
  )} policy: renter cancellations within ${windowHours} hours of payment refund the rental subtotal and deposit. Later renter cancellations refund 50% of the rental subtotal plus the deposit.`;
}

export function describeRenterCancellationRefund(params: {
  paidAt?: string | null;
  policy?: CancellationPolicy;
  fees?: Partial<PlatformFees> | null;
  now?: Date;
}) {
  if (!params.paidAt) {
    return "No payment captured yet. If you cancel now, nothing will be charged.";
  }

  const now = params.now ?? new Date();
  const paidAt = new Date(params.paidAt);
  const hoursSincePayment = Math.max(
    0,
    Math.floor((now.getTime() - paidAt.getTime()) / 3_600_000),
  );
  const windowHours = getFullRefundWindowHours(params.policy, params.fees);
  const label = getPolicyLabel(params.policy);

  if (hoursSincePayment <= windowHours) {
    return `Within the ${windowHours}-hour ${label} policy window: cancelling now refunds the rental subtotal and deposit.`;
  }

  if (label === "strict") {
    return `Outside the ${windowHours}-hour strict policy window: cancelling now refunds the deposit only.`;
  }

  return `Outside the ${windowHours}-hour ${label} policy window: cancelling now refunds 50% of the rental subtotal plus the deposit.`;
}
