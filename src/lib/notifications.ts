import { createAdminClient } from "@/lib/supabase/admin";
import {
  NOTIFICATION_CONFIG,
  type BundlePreviewItem,
  type NotificationType,
} from "@/types";

let adminIdsCache:
  | {
      fetchedAt: number;
      ids: string[];
    }
  | null = null;

const ADMIN_IDS_CACHE_MS = 5 * 60 * 1000;

interface SendNotificationParams {
  userId: string;
  type: NotificationType;
  title?: string;
  body?: string;
  actionUrl?: string;
  bookingId?: string;
  listingId?: string;
  fromUserId?: string;
  previewItem?: BundlePreviewItem;
  metadata?: Record<string, unknown>;
}

interface NotificationResult {
  id: string | null;
  bundled: boolean;
  bundleCount?: number;
}

export async function sendNotification(
  params: SendNotificationParams,
): Promise<NotificationResult> {
  const config = NOTIFICATION_CONFIG[params.type];
  const adminClient = createAdminClient();

  if (!config) {
    console.error(`Unknown notification type: ${params.type}`);
    return { id: null, bundled: false };
  }

  try {
    if (config.shouldBundle && config.bundleKey) {
      const bundleKey = config.bundleKey.replace("{userId}", params.userId);
      const actionUrl = params.actionUrl || config.defaultActionUrl;
      const previewItem: BundlePreviewItem = params.previewItem || {
        text: params.title || params.body || "New notification",
        created_at: new Date().toISOString(),
      };

      const { data, error } = await adminClient.rpc(
        "upsert_bundled_notification",
        {
          p_user_id: params.userId,
          p_bundle_key: bundleKey,
          p_type: params.type,
          p_title_template:
            config.bundleTitleTemplate ||
            `You have {count} new ${params.type} notification(s)`,
          p_action_url: actionUrl,
          p_preview_item: previewItem,
          p_related_id: params.listingId || null,
          p_from_user_id: params.fromUserId || null,
        },
      );

      if (error) {
        console.error("Failed to upsert bundled notification:", error);
        return { id: null, bundled: true };
      }

      return { id: data as string, bundled: true };
    }

    const { data, error } = await adminClient.rpc(
      "create_individual_notification",
      {
        p_user_id: params.userId,
        p_type: params.type,
        p_title: params.title || config.label,
        p_body: params.body || params.title || config.label,
        p_action_url: params.actionUrl || config.defaultActionUrl,
        p_booking_id: params.bookingId || null,
        p_listing_id: params.listingId || null,
        p_from_user_id: params.fromUserId || null,
        p_metadata: params.metadata || {},
      },
    );

    if (error) {
      console.error("Failed to create individual notification:", error);
      return { id: null, bundled: false };
    }

    return { id: data as string, bundled: false };
  } catch (error) {
    console.error("sendNotification failed:", error);
    return { id: null, bundled: false };
  }
}

export async function notifyNewMessage(params: {
  recipientId: string;
  senderName: string;
  messagePreview: string;
  conversationId: string;
}) {
  return sendNotification({
    userId: params.recipientId,
    type: "new_message",
    actionUrl: `/dashboard/messages/${params.conversationId}`,
    previewItem: {
      text:
        params.messagePreview.slice(0, 60) +
        (params.messagePreview.length > 60 ? "..." : ""),
      from_name: params.senderName,
      created_at: new Date().toISOString(),
    },
  });
}

export async function notifyNewReview(params: {
  revieweeId: string;
  reviewerName: string;
  rating: number;
  listingTitle: string;
}) {
  return sendNotification({
    userId: params.revieweeId,
    type: "review_received",
    previewItem: {
      text: `${params.rating} star review`,
      from_name: params.reviewerName,
      related_title: params.listingTitle,
      created_at: new Date().toISOString(),
    },
  });
}

export async function notifyNewBookingRequest(params: {
  listerId: string;
  renterName: string;
  listingTitle: string;
  bookingId: string;
  rentalUnits: number;
  pricingPeriod: string;
  totalPrice: number;
}) {
  return sendNotification({
    userId: params.listerId,
    type: "booking_request",
    bookingId: params.bookingId,
    previewItem: {
      text:
        `${params.renterName} wants to rent ${params.listingTitle} ` +
        `for ${params.rentalUnits} ${params.pricingPeriod}(s) — ` +
        `$${params.totalPrice}`,
      from_name: params.renterName,
      related_title: params.listingTitle,
      created_at: new Date().toISOString(),
    },
  });
}

export async function notifyBookingAccepted(params: {
  renterId: string;
  listingTitle: string;
  bookingId: string;
  paymentUrl: string;
  paymentExpiresAt: string;
  totalPrice: number;
}) {
  return sendNotification({
    userId: params.renterId,
    type: "booking_accepted",
    title: "Booking accepted — payment required",
    body:
      `Your booking for "${params.listingTitle}" has been accepted! ` +
      `Complete payment of $${params.totalPrice} to confirm. ` +
      `Payment expires: ${new Date(params.paymentExpiresAt).toLocaleString()}.`,
    actionUrl: `/renter/rentals/${params.bookingId}`,
    bookingId: params.bookingId,
    metadata: {
      paymentUrl: params.paymentUrl,
      paymentExpiresAt: params.paymentExpiresAt,
    },
  });
}

export async function notifyBookingDeclined(params: {
  renterId: string;
  listingTitle: string;
  bookingId: string;
  reason?: string;
}) {
  return sendNotification({
    userId: params.renterId,
    type: "booking_declined",
    title: "Booking request declined",
    body:
      `Your booking request for "${params.listingTitle}" was declined.` +
      (params.reason ? ` Reason: ${params.reason}` : ""),
    actionUrl: "/dashboard/my-rentals",
    bookingId: params.bookingId,
  });
}

export async function notifyBookingCancelled(params: {
  recipientId: string;
  listingTitle: string;
  bookingId: string;
  cancelledByName: string;
  reason?: string;
}) {
  return sendNotification({
    userId: params.recipientId,
    type: "booking_cancelled",
    title: "Booking cancelled",
    body:
      `The booking for "${params.listingTitle}" was cancelled ` +
      `by ${params.cancelledByName}.` +
      (params.reason ? ` Reason: ${params.reason}` : ""),
    actionUrl: `/renter/rentals/${params.bookingId}`,
    bookingId: params.bookingId,
  });
}

export async function notifyBookingCompleted(params: {
  renterId: string;
  listerId: string;
  listingTitle: string;
  bookingId: string;
}) {
  await Promise.all([
    sendNotification({
      userId: params.renterId,
      type: "booking_completed",
      title: "Rental completed!",
      body:
        `Your rental of "${params.listingTitle}" is complete. ` +
        "Please leave a review!",
      actionUrl: `/renter/rentals/${params.bookingId}`,
      bookingId: params.bookingId,
    }),
    sendNotification({
      userId: params.listerId,
      type: "booking_completed",
      title: "Rental completed!",
      body:
        `Rental of "${params.listingTitle}" has been completed. ` +
        "Please leave a review for the renter!",
      actionUrl: `/lister/bookings/${params.bookingId}`,
      bookingId: params.bookingId,
    }),
  ]);
}

export async function notifyPaymentConfirmed(params: {
  renterId: string;
  listerId: string;
  listingTitle: string;
  bookingId: string;
  amount: number;
}) {
  await Promise.all([
    sendNotification({
      userId: params.renterId,
      type: "payment_confirmed",
      title: "Payment confirmed!",
      body:
        `Your $${params.amount} payment for "${params.listingTitle}" ` +
        "is confirmed. Contact the lister to arrange handover.",
      actionUrl: `/renter/rentals/${params.bookingId}`,
      bookingId: params.bookingId,
    }),
    sendNotification({
      userId: params.listerId,
      type: "payment_received",
      title: "Payment received!",
      body:
        `$${params.amount} received for "${params.listingTitle}". ` +
        "Please arrange handover with the renter.",
      actionUrl: `/lister/bookings/${params.bookingId}`,
      bookingId: params.bookingId,
    }),
  ]);
}

export async function notifyPayoutCompleted(params: {
  listerId: string;
  amount: number;
  method: string;
  reference?: string;
  bookingId: string;
}) {
  return sendNotification({
    userId: params.listerId,
    type: "payout_completed",
    title: "Payout sent!",
    body:
      `$${params.amount} has been sent to your ${params.method} account.` +
      (params.reference ? ` Reference: ${params.reference}` : ""),
    actionUrl: "/dashboard/earnings",
    bookingId: params.bookingId,
  });
}

export async function notifyPayoutFailed(params: {
  listerId: string;
  amount: number;
  reason: string;
  bookingId: string;
}) {
  return sendNotification({
    userId: params.listerId,
    type: "payout_failed",
    title: "Payout failed",
    body:
      `Your payout of $${params.amount} could not be processed. ` +
      `Reason: ${params.reason}. ` +
      "Please update your payout settings and request a retry.",
    actionUrl: "/dashboard/settings/payments",
    bookingId: params.bookingId,
  });
}

export async function notifyRefundInitiated(params: {
  renterId: string;
  refundAmount: number;
  originalAmount: number;
  reason: string;
  bookingId: string;
}) {
  return sendNotification({
    userId: params.renterId,
    type: "refund_initiated",
    title: "Refund initiated",
    body:
      `A refund of $${params.refundAmount} ` +
      (params.refundAmount < params.originalAmount
        ? `(out of $${params.originalAmount} paid) `
        : "") +
      `is being processed. ${params.reason}. ` +
      "Please allow 5-10 business days.",
    actionUrl: `/renter/rentals/${params.bookingId}`,
    bookingId: params.bookingId,
  });
}

export async function notifyRentalStarted(params: {
  renterId: string;
  listingTitle: string;
  bookingId: string;
  rentalEndsAt: string;
}) {
  return sendNotification({
    userId: params.renterId,
    type: "rental_started",
    title: "Rental period started!",
    body:
      `Your rental of "${params.listingTitle}" has officially started. ` +
      `Return deadline: ${new Date(params.rentalEndsAt).toLocaleString()}.`,
    actionUrl: `/renter/rentals/${params.bookingId}`,
    bookingId: params.bookingId,
  });
}

export async function notifyItemReturned(params: {
  listerId: string;
  renterName: string;
  listingTitle: string;
  bookingId: string;
  isLate: boolean;
}) {
  return sendNotification({
    userId: params.listerId,
    type: "item_returned",
    title: params.isLate ? "Item returned (late)" : "Item returned",
    body:
      `${params.renterName} has returned "${params.listingTitle}". ` +
      (params.isLate ? "The item was returned after the deadline. " : "") +
      "Please inspect the condition and complete the booking.",
    actionUrl: `/lister/bookings/${params.bookingId}`,
    bookingId: params.bookingId,
  });
}

export async function notifyDisputeRaised(params: {
  otherPartyId: string;
  adminIds: string[];
  listingTitle: string;
  bookingId: string;
  raisedByName: string;
  amount: number;
}) {
  await Promise.all([
    sendNotification({
      userId: params.otherPartyId,
      type: "dispute_raised",
      title: "Dispute raised on your booking",
      body:
        `${params.raisedByName} raised a dispute on the booking for ` +
        `"${params.listingTitle}". An admin will review it shortly.`,
      actionUrl: `/renter/rentals/${params.bookingId}`,
      bookingId: params.bookingId,
    }),
    ...params.adminIds.map((adminId) =>
      sendNotification({
        userId: adminId,
        type: "dispute_raised",
        title: `Dispute requires review — $${params.amount} at stake`,
        body:
          `${params.raisedByName} raised a dispute on booking ` +
          `for "${params.listingTitle}".`,
        actionUrl: `/admin/bookings/${params.bookingId}`,
        bookingId: params.bookingId,
      }),
    ),
  ]);
}

export async function notifyDisputeResolved(params: {
  renterId: string;
  listerId: string;
  renterAmount: number;
  listerAmount: number;
  bookingId: string;
  resolutionType: string;
}) {
  await Promise.all([
    sendNotification({
      userId: params.renterId,
      type: "dispute_resolved",
      title: "Dispute resolved",
      body:
        params.renterAmount > 0
          ? `The dispute has been resolved. You will receive a refund of $${params.renterAmount}.`
          : "The dispute has been resolved. No refund will be issued.",
      actionUrl: `/dashboard/bookings/${params.bookingId}`,
      bookingId: params.bookingId,
      metadata: { resolutionType: params.resolutionType },
    }),
    sendNotification({
      userId: params.listerId,
      type: "dispute_resolved",
      title: "Dispute resolved",
      body:
        params.listerAmount > 0
          ? `The dispute has been resolved. You will receive a payout of $${params.listerAmount}.`
          : "The dispute has been resolved. No payout will be issued.",
      actionUrl: `/dashboard/bookings/${params.bookingId}`,
      bookingId: params.bookingId,
      metadata: { resolutionType: params.resolutionType },
    }),
  ]);
}

export async function notifyLowStock(params: {
  ownerId: string;
  listingTitle: string;
  listingId: string;
  quantityAvailable: number;
}) {
  return sendNotification({
    userId: params.ownerId,
    type: "low_stock",
    listingId: params.listingId,
    actionUrl: `/dashboard/inventory/${params.listingId}`,
    previewItem: {
      text: `"${params.listingTitle}" has only ${params.quantityAvailable} left`,
      related_title: params.listingTitle,
      created_at: new Date().toISOString(),
    },
  });
}

export async function notifyOutOfStock(params: {
  ownerId: string;
  listingTitle: string;
  listingId: string;
}) {
  return sendNotification({
    userId: params.ownerId,
    type: "out_of_stock",
    listingId: params.listingId,
    actionUrl: `/dashboard/inventory/${params.listingId}`,
    previewItem: {
      text: `"${params.listingTitle}" is now out of stock`,
      related_title: params.listingTitle,
      created_at: new Date().toISOString(),
    },
  });
}

export async function notifyKYCSubmitted(params: {
  userId: string;
  adminIds: string[];
  userName: string;
}) {
  await Promise.all([
    sendNotification({
      userId: params.userId,
      type: "kyc_verified",
      title: "KYC document received",
      body:
        "Your KYC document has been submitted and is under review. " +
        "You will be notified once verified (usually 1-3 business days).",
      actionUrl: "/dashboard/settings/payments",
    }),
    ...params.adminIds.map((adminId) =>
      sendNotification({
        userId: adminId,
        type: "new_kyc_submission",
        actionUrl: "/admin/kyc-verification",
        previewItem: {
          text: `${params.userName} submitted a KYC document`,
          from_name: params.userName,
          created_at: new Date().toISOString(),
        },
      }),
    ),
  ]);
}

export async function notifyKYCVerified(params: {
  userId: string;
}) {
  return sendNotification({
    userId: params.userId,
    type: "kyc_verified",
    title: "✅ KYC verified!",
    body:
      "Your identity has been verified. You can now create listings " +
      "and receive payouts via bank transfer.",
    actionUrl: "/dashboard/settings/payments",
  });
}

export async function notifyKYCRejected(params: {
  userId: string;
  reason: string;
}) {
  return sendNotification({
    userId: params.userId,
    type: "kyc_rejected",
    title: "KYC document rejected",
    body:
      `Your KYC document was rejected. Reason: ${params.reason}. ` +
      "Please upload a new document to continue.",
    actionUrl: "/dashboard/settings/payments",
  });
}

export async function notifyBookingExpired(params: {
  renterId: string;
  listerId: string;
  listingTitle: string;
  bookingId: string;
}) {
  await Promise.all([
    sendNotification({
      userId: params.renterId,
      type: "booking_expired",
      title: "Booking expired",
      body:
        `Your booking for "${params.listingTitle}" was cancelled ` +
        "because payment was not completed in time.",
      actionUrl: "/dashboard/my-rentals",
      bookingId: params.bookingId,
    }),
    sendNotification({
      userId: params.listerId,
      type: "booking_expired",
      title: "Booking expired",
      body:
        `A booking for "${params.listingTitle}" was cancelled ` +
        "because the renter did not complete payment in time. " +
        "Stock has been released.",
      actionUrl: "/dashboard/requests",
      bookingId: params.bookingId,
    }),
  ]);
}

export async function getAdminIds(): Promise<string[]> {
  const now = Date.now();
  if (adminIdsCache && now - adminIdsCache.fetchedAt < ADMIN_IDS_CACHE_MS) {
    return adminIdsCache.ids;
  }

  const adminClient = createAdminClient();
  const { data, error } = await adminClient
    .from("profiles")
    .select("id")
    .eq("is_admin", true);

  if (error) {
    console.error("getAdminIds failed:", error);
    return [];
  }

  const ids = (data ?? [])
    .map((profile) => (typeof profile.id === "string" ? profile.id : ""))
    .filter(Boolean);

  adminIdsCache = {
    fetchedAt: now,
    ids,
  };

  return ids;
}
