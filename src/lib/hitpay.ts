import { createHmac, timingSafeEqual } from "node:crypto";
import {
  differenceInCalendarDays,
  differenceInHours,
  startOfDay,
} from "date-fns";

import { env, getHitPayApiUrl } from "@/lib/env";
import type { Listing, PricingCalculation, PricingPeriod } from "@/types";

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function getUnitPrice(listing: Listing, pricingPeriod: PricingPeriod) {
  switch (pricingPeriod) {
    case "hour":
      return listing.price_per_hour;
    case "week":
      return listing.price_per_week;
    case "month":
      return listing.price_per_month;
    case "day":
    default:
      return listing.price_per_day;
  }
}

function calculateNumUnits(
  startDate: Date,
  endDate: Date,
  pricingPeriod: PricingPeriod,
) {
  if (endDate <= startDate) {
    return 0;
  }

  const calendarDayCount = differenceInCalendarDays(
    startOfDay(endDate),
    startOfDay(startDate),
  );

  switch (pricingPeriod) {
    case "hour":
      return Math.max(
        1,
        differenceInHours(endDate, startDate, {
          roundingMethod: "ceil",
        }),
      );
    case "week":
      return Math.max(1, Math.ceil(calendarDayCount / 7));
    case "month":
      return Math.max(1, Math.ceil(calendarDayCount / 30));
    case "day":
    default:
      return Math.max(1, calendarDayCount);
  }
}

export async function createPaymentRequest(params: {
  amount: number;
  currency: string;
  email: string;
  name: string;
  purpose: string;
  reference_number: string;
  redirect_url: string;
  webhook: string;
}): Promise<{ id: string; url: string; status: string }> {
  if (!env.HITPAY_API_KEY) {
    throw new Error("Missing required environment variable: HITPAY_API_KEY");
  }

  const body = new URLSearchParams({
    amount: params.amount.toFixed(2),
    currency: params.currency,
    email: params.email,
    name: params.name,
    purpose: params.purpose,
    reference_number: params.reference_number,
    redirect_url: params.redirect_url,
    webhook: params.webhook,
    allow_repeated_payments: "false",
  });

  const response = await fetch(`${getHitPayApiUrl()}/payment-requests`, {
    method: "POST",
    headers: {
      "X-BUSINESS-API-KEY": env.HITPAY_API_KEY,
      "X-Requested-With": "XMLHttpRequest",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
    cache: "no-store",
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || "Failed to create HitPay payment request");
  }

  const data = (await response.json()) as Record<string, unknown>;
  const id = typeof data.id === "string" ? data.id : "";
  const url = typeof data.url === "string" ? data.url : "";
  const status = typeof data.status === "string" ? data.status : "pending";

  if (!id || !url) {
    throw new Error("HitPay response did not include a payment request ID or URL");
  }

  return { id, url, status };
}

export async function getPaymentStatus(
  paymentRequestId: string,
): Promise<{ status: string; payments: Record<string, unknown>[] }> {
  console.log("[HITPAY_API] Fetching payment status for request:", paymentRequestId);

  if (!env.HITPAY_API_KEY) {
    throw new Error("Missing required environment variable: HITPAY_API_KEY");
  }

  const response = await fetch(
    `${getHitPayApiUrl()}/payment-requests/${paymentRequestId}`,
    {
      method: "GET",
      headers: {
        "X-BUSINESS-API-KEY": env.HITPAY_API_KEY,
        "X-Requested-With": "XMLHttpRequest",
      },
      cache: "no-store",
    },
  );

  console.log("[HITPAY_API] API response status:", response.status);

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[HITPAY_API] API error:", errorText);
    throw new Error(errorText || "Failed to fetch HitPay payment status");
  }

  const data = (await response.json()) as Record<string, unknown>;
  
  // Log the full response for debugging
  console.log("[HITPAY_API] Full API response:", JSON.stringify(data, null, 2));
  console.log("[HITPAY_API] API response data status:", data.status);
  console.log("[HITPAY_API] API response data keys:", Object.keys(data));
  
  // Check for alternative status fields that HitPay might use
  const altStatusFields = ["status", "payment_status", "state", "payment_state"];
  let foundStatus = "unknown";
  for (const field of altStatusFields) {
    if (data[field] && typeof data[field] === "string") {
      console.log(`[HITPAY_API] Found status in field '${field}':`, data[field]);
      foundStatus = data[field] as string;
      break;
    }
  }

  return {
    status: foundStatus,
    payments: Array.isArray(data.payments)
      ? (data.payments as Record<string, unknown>[])
      : [],
  };
}

export function verifyWebhookSignature(
  payload: Record<string, string> | string,
  signature: string,
) {
  const salt = env.HITPAY_WEBHOOK_SALT;

  if (!salt || !signature) {
    console.log("[SIGNATURE] Missing salt or signature:", {
      hasSalt: !!salt,
      hasSignature: !!signature,
    });
    return false;
  }

  // Handle different signature formats using Uint8Array
  let signatureBytes: Uint8Array;
  try {
    // Try hex format first (most common)
    if (signature.length === 64) {
      signatureBytes = new Uint8Array(
        signature.match(/.{1,2}/g)?.map((byte) => parseInt(byte, 16)) ?? []
      );
    } else if (signature.length === 44 && signature.includes("=")) {
      // Base64 format
      const binary = atob(signature);
      signatureBytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        signatureBytes[i] = binary.charCodeAt(i);
      }
    } else {
      // Try as hex anyway
      signatureBytes = new Uint8Array(
        signature.match(/.{1,2}/g)?.map((byte: string) => parseInt(byte, 16)) ?? []
      );
    }
  } catch (e) {
    console.log("[SIGNATURE] Failed to parse signature:", signature.substring(0, 20));
    return false;
  }

  let payloadToVerify: string;
  if (typeof payload === "string") {
    payloadToVerify = payload;
  } else {
    // For object payloads, sort keys and create string (excluding hmac)
    const sortedKeys = Object.keys({ ...payload, hmac: undefined as unknown as string })
      .filter((key) => key !== "hmac")
      .sort((a, b) => a.localeCompare(b));
    payloadToVerify = sortedKeys.map((key) => `${key}${payload[key]}`).join("");
  }

  console.log("[SIGNATURE] Payload length:", payloadToVerify.length);
  console.log("[SIGNATURE] Signature length:", signatureBytes.length);

  const generated = createHmac("sha256", salt)
    .update(payloadToVerify)
    .digest("hex");

  const generatedBytes = new Uint8Array(
    generated.match(/.{1,2}/g)?.map((byte: string) => parseInt(byte, 16)) ?? []
  );

  if (generatedBytes.length !== signatureBytes.length) {
    console.log("[SIGNATURE] Length mismatch:", {
      generated: generatedBytes.length,
      received: signatureBytes.length,
    });
    return false;
  }

  return timingSafeEqual(generatedBytes, signatureBytes);
}

export function calculatePricing(params: {
  listing: Listing;
  startDate: Date;
  endDate: Date;
  quantity: number;
  pricingPeriod: PricingPeriod;
}): PricingCalculation {
  const unitPrice = getUnitPrice(params.listing, params.pricingPeriod);

  if (typeof unitPrice !== "number") {
    throw new Error(`This listing does not support ${params.pricingPeriod} pricing`);
  }

  const numUnits = calculateNumUnits(
    params.startDate,
    params.endDate,
    params.pricingPeriod,
  );
  const subtotal = roundMoney(unitPrice * numUnits * params.quantity);
  const serviceFeeRenter = roundMoney(subtotal * 0.05);
  const serviceFeeLister = roundMoney(subtotal * 0.05);
  const depositAmount = roundMoney(
    (params.listing.deposit_amount ?? 0) * params.quantity,
  );
  const deliveryFee = params.listing.delivery_available
    ? params.listing.delivery_fee ?? 0
    : 0;
  const totalPrice = roundMoney(
    subtotal + serviceFeeRenter + depositAmount + deliveryFee,
  );
  const listerPayout = roundMoney(subtotal - serviceFeeLister);

  return {
    subtotal,
    serviceFeeRenter,
    serviceFeeLister,
    depositAmount,
    deliveryFee,
    totalPrice,
    listerPayout,
    numUnits,
    unitPrice,
  };
}
