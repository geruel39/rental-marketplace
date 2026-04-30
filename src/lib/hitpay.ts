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
): Promise<{
  amount: number | null;
  currency: string | null;
  paymentId: string | null;
  paymentRequestId: string;
  payments: Record<string, unknown>[];
  status: string;
}> {
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

  const payments = Array.isArray(data.payments)
    ? (data.payments as Record<string, unknown>[])
    : [];
  const completedPayment =
    payments.find((entry) => {
      const paymentStatus =
        typeof entry.status === "string"
          ? entry.status
          : typeof entry.payment_status === "string"
            ? entry.payment_status
            : typeof entry.state === "string"
              ? entry.state
              : typeof entry.payment_state === "string"
                ? entry.payment_state
                : null;

      return paymentStatus?.toLowerCase() === "completed";
    }) ?? payments[0] ?? null;
  const nestedCompletedStatus =
    completedPayment &&
    (() => {
      const nestedStatus =
        typeof completedPayment.status === "string"
          ? completedPayment.status
          : typeof completedPayment.payment_status === "string"
            ? completedPayment.payment_status
            : typeof completedPayment.state === "string"
              ? completedPayment.state
              : typeof completedPayment.payment_state === "string"
                ? completedPayment.payment_state
                : null;

      return nestedStatus?.toLowerCase() === "completed";
    })();

  const paymentId =
    completedPayment && typeof completedPayment.id === "string"
      ? completedPayment.id
      : completedPayment && typeof completedPayment.payment_id === "string"
        ? completedPayment.payment_id
        : typeof data.payment_id === "string"
          ? data.payment_id
          : null;
  const amountRaw =
    typeof data.amount === "number"
      ? data.amount
      : typeof data.amount === "string"
        ? Number(data.amount)
        : completedPayment && typeof completedPayment.amount === "number"
          ? completedPayment.amount
          : completedPayment && typeof completedPayment.amount === "string"
            ? Number(completedPayment.amount)
            : null;
  const currency =
    typeof data.currency === "string"
      ? data.currency
      : completedPayment && typeof completedPayment.currency === "string"
        ? completedPayment.currency
        : null;

  return {
    amount: typeof amountRaw === "number" && Number.isFinite(amountRaw) ? amountRaw : null,
    currency,
    paymentId,
    paymentRequestId,
    status: nestedCompletedStatus ? "completed" : foundStatus,
    payments,
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

  const normalizedSignature = signature
    .trim()
    .replace(/^sha256=/i, "")
    .replace(/^"+|"+$/g, "");

  let signatureBytes: Buffer;
  try {
    if (/^[\da-f]+$/i.test(normalizedSignature) && normalizedSignature.length % 2 === 0) {
      signatureBytes = Buffer.from(normalizedSignature, "hex");
    } else {
      const paddedBase64 = normalizedSignature
        .replace(/-/g, "+")
        .replace(/_/g, "/")
        .padEnd(Math.ceil(normalizedSignature.length / 4) * 4, "=");
      signatureBytes = Buffer.from(paddedBase64, "base64");
    }
  } catch {
    console.log(
      "[SIGNATURE] Failed to parse signature:",
      normalizedSignature.substring(0, 20),
    );
    return false;
  }

  const payloadCandidates: string[] = [];
  if (typeof payload === "string") {
    payloadCandidates.push(payload);

    try {
      payloadCandidates.push(JSON.stringify(JSON.parse(payload)));
    } catch {
      // Raw body is not JSON; no alternate candidate needed.
    }
  } else {
    const sortedKeys = Object.keys({ ...payload, hmac: undefined as unknown as string })
      .filter((key) => key !== "hmac")
      .sort((a, b) => a.localeCompare(b));
    payloadCandidates.push(sortedKeys.map((key) => `${key}${payload[key]}`).join(""));
    payloadCandidates.push(JSON.stringify(payload));
  }

  console.log("[SIGNATURE] Payload length:", payloadCandidates[0]?.length ?? 0);
  console.log("[SIGNATURE] Signature length:", signatureBytes.length);

  for (const payloadToVerify of payloadCandidates) {
    const generated = createHmac("sha256", salt).update(payloadToVerify).digest();

    if (generated.length !== signatureBytes.length) {
      continue;
    }

    if (timingSafeEqual(generated, signatureBytes)) {
      return true;
    }
  }

  console.log("[SIGNATURE] No matching payload candidate for signature");
  return false;
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
