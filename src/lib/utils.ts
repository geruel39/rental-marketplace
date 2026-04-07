import { clsx, type ClassValue } from "clsx";
import { format, formatDistanceToNow } from "date-fns";
import { twMerge } from "tailwind-merge";

import type { PayoutMethod } from "@/types";

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

export function formatListingLocation(
  city?: string | null,
  state?: string | null,
  fallback?: string | null,
): string {
  const formatted = [city, state].filter(Boolean).join(", ");
  return formatted || fallback || "";
}
