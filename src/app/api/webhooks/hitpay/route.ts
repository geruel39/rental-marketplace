import { NextResponse } from "next/server";

import { handlePaymentConfirmed } from "@/actions/payments";
import { verifyWebhookSignature } from "@/lib/hitpay";

function getNestedRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function getFirstString(
  sources: Array<Record<string, unknown> | null>,
  keys: string[],
) {
  for (const source of sources) {
    if (!source) {
      continue;
    }
    for (const key of keys) {
      const value = source[key];
      if (typeof value === "string" && value.length > 0) {
        return value;
      }
    }
  }

  return "";
}

function getFirstNumber(
  sources: Array<Record<string, unknown> | null>,
  keys: string[],
) {
  for (const source of sources) {
    if (!source) {
      continue;
    }

    for (const key of keys) {
      const value = source[key];
      if (typeof value === "number" && Number.isFinite(value)) {
        return value;
      }
      if (typeof value === "string" && value.trim().length > 0) {
        const parsed = Number(value);
        if (Number.isFinite(parsed)) {
          return parsed;
        }
      }
    }
  }

  return null;
}

function normalizeEventPayload(payload: Record<string, unknown>) {
  const event = getFirstString([payload], ["event", "type", "event_type", "eventType"]);
  const data = getNestedRecord(payload.data) ?? payload;
  const paymentRequest = getNestedRecord(data.payment_request);
  const order = getNestedRecord(data.order);
  const metadata = getNestedRecord(data.metadata);
  const relatable = getNestedRecord(data.relatable);
  const sources = [data, paymentRequest, order, metadata, relatable];

  return {
    event,
    bookingId: getFirstString(sources, [
      "reference_number",
      "reference",
      "booking_id",
      "bookingId",
      "order_id",
    ]),
    paymentId: getFirstString(sources, [
      "payment_id",
      "paymentId",
      "id",
      "transaction_id",
    ]),
    paymentRequestId: getFirstString(sources, [
      "payment_request_id",
      "paymentRequestId",
      "payment_request",
    ]),
    status: getFirstString(sources, ["status", "payment_status", "state"]),
    amount: getFirstNumber(sources, ["amount"]),
    currency: getFirstString(sources, ["currency"]),
  };
}

export async function GET() {
  return NextResponse.json({ success: true }, { status: 200 });
}

export async function HEAD() {
  return new NextResponse(null, { status: 200 });
}

export async function POST(request: Request) {
  try {
    const signature =
      request.headers.get("Hitpay-Signature") ??
      request.headers.get("x-hitpay-signature") ??
      "";
    const contentType = request.headers.get("content-type") ?? "";
    const rawBody = await request.text();

    let normalizedPayload: Record<string, unknown>;
    let fallbackSignature = "";

    if (contentType.includes("application/json")) {
      normalizedPayload = rawBody
        ? (JSON.parse(rawBody) as Record<string, unknown>)
        : {};
    } else {
      const formData = new URLSearchParams(rawBody);
      const payload = Object.fromEntries(formData.entries());
      normalizedPayload = payload as Record<string, unknown>;
      fallbackSignature = payload.hmac ?? "";
    }

    const headerSignatureValid = verifyWebhookSignature(rawBody, signature);
    const fallbackSignatureValid = fallbackSignature
      ? verifyWebhookSignature(normalizedPayload as Record<string, string>, fallbackSignature)
      : false;

    if (!headerSignatureValid && !fallbackSignatureValid) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const normalized = normalizeEventPayload(normalizedPayload);
    const normalizedStatus = normalized.status.toLowerCase();
    const normalizedEvent = normalized.event.toLowerCase();
    const isCompletedEvent =
      normalizedEvent.includes("completed") ||
      normalizedEvent.includes("paid") ||
      normalizedStatus === "completed" ||
      normalizedStatus === "succeeded" ||
      normalizedStatus === "paid";

    if (isCompletedEvent && normalized.bookingId) {
      await handlePaymentConfirmed({
        hitpayPaymentId: normalized.paymentId || "",
        hitpayPaymentRequestId: normalized.paymentRequestId || "",
        bookingId: normalized.bookingId,
        amount: normalized.amount ?? 0,
        currency: normalized.currency || "SGD",
      });
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("[WEBHOOK] Error processing webhook:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Webhook processing failed",
      },
      { status: 500 },
    );
  }
}
