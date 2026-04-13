import { clsx, type ClassValue } from "clsx";
import { format, formatDistanceToNow } from "date-fns";
import { twMerge } from "tailwind-merge";

import type {
  PaymentBreakdown,
  PaymentEventType,
  PayoutMethod,
  PlatformFees,
  PricingPeriod,
} from "@/types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatDate(date: string | Date) {
  return format(new Date(date), "PPP");
}

export function formatRelativeTime(date: string | Date) {
  return formatDistanceToNow(new Date(date), { addSuffix: true });
}

export function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);

  if (parts.length === 0) {
    return "";
  }

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return parts
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

export function slugify(text: string) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

export function getPayoutMethodLabel(method: PayoutMethod): string {
  switch (method) {
    case "bank":
      return "Bank Account";
    case "gcash":
      return "GCash";
    case "maya":
      return "Maya";
  }
}

export function getPayoutMethodIcon(method: PayoutMethod): string {
  switch (method) {
    case "bank":
      return "Building";
    case "gcash":
      return "Smartphone";
    case "maya":
      return "CreditCard";
  }
}

export function formatPhoneNumber(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  let normalized = digits;

  if (normalized.startsWith("0")) {
    normalized = `63${normalized.slice(1)}`;
  } else if (!normalized.startsWith("63")) {
    normalized = `63${normalized}`;
  }

  const localNumber = normalized.slice(-10);

  return `+63 ${localNumber.slice(0, 3)} ${localNumber.slice(
    3,
    6,
  )} ${localNumber.slice(6)}`;
}

export function maskAccountNumber(accountNumber: string): string {
  const visibleDigits = accountNumber.slice(-4);
  const maskedPrefix = "*".repeat(Math.max(0, accountNumber.length - 4));

  return `${maskedPrefix}${visibleDigits}`;
}

export function formatTransactionType(eventType: PaymentEventType): string {
  switch (eventType) {
    case "payment_initiated":
      return "Payment Initiated";
    case "payment_completed":
      return "Payment Received";
    case "payment_failed":
      return "Payment Failed";
    case "payment_expired":
      return "Payment Expired";
    case "refund_initiated":
      return "Refund Initiated";
    case "refund_completed":
      return "Refund Sent";
    case "refund_failed":
      return "Refund Failed";
    case "payout_initiated":
      return "Payout Initiated";
    case "payout_completed":
      return "Payout Processed";
    case "payout_failed":
      return "Payout Failed";
    case "payout_retry_requested":
      return "Payout Retry Requested";
    case "dispute_hold":
      return "Dispute Hold";
    case "dispute_released_lister":
      return "Dispute Released to Lister";
    case "dispute_released_renter":
      return "Dispute Released to Renter";
    case "dispute_split":
      return "Dispute Split Resolution";
  }
}

export function formatTransactionStatus(status: string): {
  label: string;
  color: string;
} {
  switch (status) {
    case "pending":
      return {
        label: "Pending",
        color: "bg-yellow-100 text-yellow-800",
      };
    case "processing":
      return {
        label: "Processing",
        color: "bg-blue-100 text-blue-800",
      };
    case "completed":
      return {
        label: "Completed",
        color: "bg-emerald-100 text-emerald-800",
      };
    case "failed":
      return {
        label: "Failed",
        color: "bg-red-100 text-red-800",
      };
    default:
      return {
        label: "Unknown",
        color: "bg-slate-100 text-slate-700",
      };
  }
}

export function calculatePaymentBreakdown(params: {
  subtotal: number;
  depositAmount: number;
  pricingPeriod: PricingPeriod;
  fees: PlatformFees;
}): PaymentBreakdown {
  const { subtotal, depositAmount, pricingPeriod, fees } = params;

  // Pricing period is accepted to keep the helper aligned with booking pricing flows.
  void pricingPeriod;

  const serviceFeeRenter = subtotal * fees.platform_service_fee_renter;
  const serviceFeeLister = subtotal * fees.platform_service_fee_lister;
  const hitpayFeeBase = subtotal + serviceFeeRenter + depositAmount;
  const hitpayFee =
    hitpayFeeBase * fees.hitpay_percentage_fee + fees.hitpay_fixed_fee;
  const totalChargedToRenter =
    subtotal +
    serviceFeeRenter +
    depositAmount +
    (fees.platform_absorbs_hitpay_fee ? 0 : hitpayFee);
  const listerGross = subtotal;
  const listerPayout = listerGross - serviceFeeLister;
  const platformTotalKept =
    serviceFeeRenter +
    serviceFeeLister +
    (fees.platform_absorbs_hitpay_fee ? hitpayFee : 0);

  return {
    subtotal,
    service_fee_renter: serviceFeeRenter,
    deposit_amount: depositAmount,
    hitpay_fee: hitpayFee,
    platform_absorbs_hitpay: fees.platform_absorbs_hitpay_fee,
    total_charged_to_renter: totalChargedToRenter,
    lister_gross: listerGross,
    service_fee_lister: serviceFeeLister,
    lister_payout: listerPayout,
    platform_total_kept: platformTotalKept,
  };
}

export function formatListingLocation(
  city?: string | null,
  state?: string | null,
  fallback?: string | null,
): string {
  const formatted = [city, state].filter(Boolean).join(", ");
  return formatted || fallback || "";
}
