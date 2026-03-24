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
  console.log("[HITPAY_API] API response data status:", data.status);

  return {
    status: typeof data.status === "string" ? data.status : "unknown",
    payments: Array.isArray(data.payments)
      ? (data.payments as Record<string, unknown>[])
      : [],
  };
}

export function verifyWebhookSignature(
  payload: Record<string, string> | string,
  signature: string,
) {
  if (!env.HITPAY_WEBHOOK_SALT || !signature) {
    return false;
  }

  const generated = createHmac("sha256", env.HITPAY_WEBHOOK_SALT)
    .update(
      typeof payload === "string"
        ? payload
        : Object.keys({ ...payload, hmac: undefined as unknown as string })
            .filter((key) => key !== "hmac")
            .sort((a, b) => a.localeCompare(b))
            .map((key) => `${key}${payload[key]}`)
            .join(""),
    )
    .digest("hex");

  const generatedBuffer = Buffer.from(generated, "hex");
  const signatureBuffer = Buffer.from(signature, "hex");

  if (generatedBuffer.length !== signatureBuffer.length) {
    return false;
  }

  return timingSafeEqual(generatedBuffer, signatureBuffer);
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
    ? roundMoney(params.listing.delivery_fee ?? 0)
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
