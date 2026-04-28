import * as Email from "@/lib/email";
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

async function getUserEmailPrefs(userId: string): Promise<{
  email: string;
  emailBookings: boolean;
  emailReviews: boolean;
  wantsEmails: boolean;
}> {
  const adminClient = createAdminClient();
  const { data } = await adminClient
    .from("profiles")
    .select("email, notification_preferences")
    .eq("id", userId)
    .single();

  const prefs =
    (data?.notification_preferences as Record<string, boolean> | null) ?? {};

  return {
    email: data?.email ?? "",
    emailBookings: prefs.email_bookings !== false,
    emailReviews: prefs.email_reviews !== false,
    wantsEmails: true,
  };
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
  revieweeName?: string;
  comment?: string;
}) {
  const result = await sendNotification({
    userId: params.revieweeId,
    type: "review_received",
    previewItem: {
      text: `${params.rating} star review`,
      from_name: params.reviewerName,
      related_title: params.listingTitle,
      created_at: new Date().toISOString(),
    },
  });

  try {
    const prefs = await getUserEmailPrefs(params.revieweeId);
    if (prefs.email && prefs.emailReviews) {
      void Email.sendReviewReceivedEmail({
        to: prefs.email,
        recipientName: params.revieweeName ?? "User",
        reviewerName: params.reviewerName,
        rating: params.rating,
        comment: params.comment,
        listingTitle: params.listingTitle,
      });
    }
  } catch (e) {
    console.error("Email error in notifyNewReview:", e);
  }

  return result;
}

export async function notifyNewBookingRequest(params: {
  listerId: string;
  renterName: string;
  listingTitle?: string;
  bookingId?: string;
  rentalUnits?: number;
  pricingPeriod?: string;
  totalPrice?: number;
  renterId?: string;
  listingId?: string;
  quantity?: number;
}) {
  const result = await sendNotification({
    userId: params.listerId,
    type: "booking_request",
    bookingId: params.bookingId,
    listingId: params.listingId,
    previewItem: {
      text:
        `${params.renterName} wants to rent ${params.listingTitle ?? "your listing"} ` +
        `for ${params.rentalUnits ?? 1} ${params.pricingPeriod ?? "day"}(s) - ` +
        `$${params.totalPrice ?? 0}`,
      from_name: params.renterName,
      related_title: params.listingTitle ?? "your listing",
      created_at: new Date().toISOString(),
    },
  });

  try {
    const prefs = await getUserEmailPrefs(params.listerId);
    if (prefs.email && prefs.emailBookings) {
      const adminClient = createAdminClient();
      const [listerResult, renterResult, listingResult] = await Promise.all([
        adminClient
          .from("profiles")
          .select("display_name")
          .eq("id", params.listerId)
          .single(),
        adminClient
          .from("profiles")
          .select("display_name")
          .eq("id", params.renterId ?? "")
          .single(),
        adminClient
          .from("listings")
          .select("title, pricing_period: primary_pricing_period")
          .eq("id", params.listingId ?? "")
          .single(),
      ]);

      void Email.sendBookingConfirmationRequiredEmail({
        to: prefs.email,
        listerName: listerResult.data?.display_name ?? "Lister",
        renterName: renterResult.data?.display_name ?? params.renterName,
        listingTitle:
          params.listingTitle ?? listingResult.data?.title ?? "Your listing",
        rentalUnits: params.rentalUnits ?? 1,
        pricingPeriod:
          params.pricingPeriod ??
          listingResult.data?.pricing_period ??
          "day",
        quantity: params.quantity ?? 1,
        totalPrice: params.totalPrice ?? 0,
        deadline: new Date(
          Date.now() + 24 * 60 * 60 * 1000,
        ).toLocaleString(),
        bookingId: params.bookingId ?? "",
      });
    }
  } catch (e) {
    console.error("Email error in notifyNewBookingRequest:", e);
  }

  return result;
}

export async function notifyBookingAccepted(params: {
  renterId: string;
  listingTitle: string;
  bookingId: string;
  paymentUrl?: string;
  paymentExpiresAt?: string;
  totalPrice: number;
  renterName?: string;
  listerName?: string;
  rentalUnits?: number;
  pricingPeriod?: string;
  quantity?: number;
}) {
  const result = await sendNotification({
    userId: params.renterId,
    type: "payment_confirmed",
    title: "Booking confirmed!",
    body:
      `${params.listerName ?? "The lister"} confirmed your booking for "${params.listingTitle}". ` +
      "Contact them to arrange handover.",
    actionUrl: `/renter/rentals/${params.bookingId}`,
    bookingId: params.bookingId,
    metadata: {
      paymentUrl: params.paymentUrl,
      paymentExpiresAt: params.paymentExpiresAt,
    },
  });

  try {
    const prefs = await getUserEmailPrefs(params.renterId);
    if (prefs.email && prefs.emailBookings) {
      void Email.sendBookingConfirmedEmail({
        to: prefs.email,
        renterName: params.renterName ?? "Renter",
        listerName: params.listerName ?? "Lister",
        listingTitle: params.listingTitle,
        rentalUnits: params.rentalUnits ?? 1,
        pricingPeriod: params.pricingPeriod ?? "day",
        quantity: params.quantity ?? 1,
        totalPrice: params.totalPrice,
        bookingId: params.bookingId,
      });
    }
  } catch (e) {
    console.error("Email error in notifyBookingAccepted:", e);
  }

  return result;
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
  recipientName?: string;
  cancelledByRole?: "renter" | "lister" | "system";
  rentalUnits?: number;
  pricingPeriod?: string;
  totalPrice?: number;
  refundAmount?: number;
  refundPercent?: number;
  recipientRole?: "renter" | "lister";
}) {
  const actionUrl =
    params.recipientRole === "lister"
      ? `/lister/bookings/${params.bookingId}`
      : `/renter/rentals/${params.bookingId}`;

  const result = await sendNotification({
    userId: params.recipientId,
    type: "booking_cancelled",
    title: "Booking cancelled",
    body:
      `The booking for "${params.listingTitle}" was cancelled ` +
      `by ${params.cancelledByName}.` +
      (params.reason ? ` Reason: ${params.reason}` : ""),
    actionUrl,
    bookingId: params.bookingId,
  });

  try {
    const prefs = await getUserEmailPrefs(params.recipientId);
    if (prefs.email && prefs.emailBookings) {
      void Email.sendBookingCancelledEmail({
        to: prefs.email,
        recipientName: params.recipientName ?? "User",
        cancelledByName: params.cancelledByName,
        cancelledByRole: params.cancelledByRole ?? "system",
        listingTitle: params.listingTitle,
        rentalUnits: params.rentalUnits ?? 1,
        pricingPeriod: params.pricingPeriod ?? "day",
        totalPrice: params.totalPrice ?? 0,
        refundAmount: params.refundAmount ?? 0,
        refundPercent: params.refundPercent ?? 0,
        reason: params.reason,
        bookingId: params.bookingId,
        recipientRole: params.recipientRole ?? "renter",
      });
    }
  } catch (e) {
    console.error("Email error in notifyBookingCancelled:", e);
  }

  return result;
}

export async function notifyBookingCompleted(params: {
  renterId: string;
  listerId: string;
  listingTitle: string;
  bookingId: string;
  renterName?: string;
  listerName?: string;
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

  try {
    const [renterPrefs, listerPrefs] = await Promise.all([
      getUserEmailPrefs(params.renterId),
      getUserEmailPrefs(params.listerId),
    ]);

    const emailPromises: Promise<void>[] = [];

    if (renterPrefs.email && renterPrefs.emailBookings) {
      emailPromises.push(
        Email.sendRentalCompletedEmail({
          to: renterPrefs.email,
          recipientName: params.renterName ?? "Renter",
          role: "renter",
          listingTitle: params.listingTitle,
          otherPartyName: params.listerName ?? "Lister",
          bookingId: params.bookingId,
        }),
      );
    }

    if (listerPrefs.email && listerPrefs.emailBookings) {
      emailPromises.push(
        Email.sendRentalCompletedEmail({
          to: listerPrefs.email,
          recipientName: params.listerName ?? "Lister",
          role: "lister",
          listingTitle: params.listingTitle,
          otherPartyName: params.renterName ?? "Renter",
          bookingId: params.bookingId,
        }),
      );
    }

    void Promise.all(emailPromises);
  } catch (e) {
    console.error("Email error in notifyBookingCompleted:", e);
  }
}

export async function notifyPaymentConfirmed(params: {
  renterId: string;
  listerId: string;
  listingTitle: string;
  bookingId: string;
  amount: number;
  renterName?: string;
  listerName?: string;
  rentalUnits?: number;
  pricingPeriod?: string;
  quantity?: number;
  paymentReference?: string;
  listerPayout?: number;
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

  try {
    const [renterPrefs, listerPrefs] = await Promise.all([
      getUserEmailPrefs(params.renterId),
      getUserEmailPrefs(params.listerId),
    ]);

    const emailPromises: Promise<void>[] = [];

    if (renterPrefs.email && renterPrefs.emailBookings) {
      emailPromises.push(
        Email.sendPaymentConfirmedEmail({
          to: renterPrefs.email,
          recipientName: params.renterName ?? "Renter",
          role: "renter",
          listingTitle: params.listingTitle,
          rentalUnits: params.rentalUnits ?? 1,
          pricingPeriod: params.pricingPeriod ?? "day",
          quantity: params.quantity ?? 1,
          amountPaid: params.amount,
          paymentReference: params.paymentReference ?? "",
          bookingId: params.bookingId,
        }),
      );
    }

    if (listerPrefs.email && listerPrefs.emailBookings) {
      emailPromises.push(
        Email.sendPaymentConfirmedEmail({
          to: listerPrefs.email,
          recipientName: params.listerName ?? "Lister",
          role: "lister",
          listingTitle: params.listingTitle,
          rentalUnits: params.rentalUnits ?? 1,
          pricingPeriod: params.pricingPeriod ?? "day",
          quantity: params.quantity ?? 1,
          amountPaid: params.amount,
          payoutAmount: params.listerPayout,
          paymentReference: params.paymentReference ?? "",
          bookingId: params.bookingId,
        }),
      );
    }

    void Promise.all(emailPromises);
  } catch (e) {
    console.error("Email error in notifyPaymentConfirmed:", e);
  }
}

export async function notifyPayoutCompleted(params: {
  listerId: string;
  amount: number;
  method: string;
  reference?: string;
  bookingId: string;
  listerName?: string;
  listingTitle?: string;
}) {
  const result = await sendNotification({
    userId: params.listerId,
    type: "payout_completed",
    title: "Payout sent!",
    body:
      `$${params.amount} has been sent to your ${params.method} account.` +
      (params.reference ? ` Reference: ${params.reference}` : ""),
    actionUrl: "/dashboard/earnings",
    bookingId: params.bookingId,
  });

  try {
    const prefs = await getUserEmailPrefs(params.listerId);
    if (prefs.email) {
      void Email.sendPayoutProcessedEmail({
        to: prefs.email,
        listerName: params.listerName ?? "Lister",
        amount: params.amount,
        payoutMethod: params.method,
        reference: params.reference,
        listingTitle: params.listingTitle ?? "",
        bookingId: params.bookingId,
      });
    }
  } catch (e) {
    console.error("Email error in notifyPayoutCompleted:", e);
  }

  return result;
}

export async function notifyPayoutFailed(params: {
  listerId: string;
  amount: number;
  reason: string;
  bookingId: string;
  listerName?: string;
}) {
  const result = await sendNotification({
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

  try {
    const prefs = await getUserEmailPrefs(params.listerId);
    if (prefs.email) {
      void Email.sendPayoutFailedEmail({
        to: prefs.email,
        listerName: params.listerName ?? "Lister",
        amount: params.amount,
        reason: params.reason,
      });
    }
  } catch (e) {
    console.error("Email error in notifyPayoutFailed:", e);
  }

  return result;
}

export async function notifyRefundInitiated(params: {
  renterId: string;
  refundAmount: number;
  originalAmount: number;
  reason: string;
  bookingId: string;
  renterName?: string;
  listingTitle?: string;
}) {
  const result = await sendNotification({
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

  try {
    const prefs = await getUserEmailPrefs(params.renterId);
    if (prefs.email) {
      void Email.sendRefundInitiatedEmail({
        to: prefs.email,
        renterName: params.renterName ?? "Renter",
        refundAmount: params.refundAmount,
        originalAmount: params.originalAmount,
        reason: params.reason,
        listingTitle: params.listingTitle ?? "",
        bookingId: params.bookingId,
      });
    }
  } catch (e) {
    console.error("Email error in notifyRefundInitiated:", e);
  }

  return result;
}

export async function notifyRentalStarted(params: {
  renterId: string;
  listingTitle: string;
  bookingId: string;
  rentalEndsAt: string;
  renterName?: string;
  listerName?: string;
  rentalUnits?: number;
  pricingPeriod?: string;
}) {
  const result = await sendNotification({
    userId: params.renterId,
    type: "rental_started",
    title: "Rental period started!",
    body:
      `Your rental of "${params.listingTitle}" has officially started. ` +
      `Return deadline: ${new Date(params.rentalEndsAt).toLocaleString()}.`,
    actionUrl: `/renter/rentals/${params.bookingId}`,
    bookingId: params.bookingId,
  });

  try {
    const prefs = await getUserEmailPrefs(params.renterId);
    if (prefs.email && prefs.emailBookings) {
      void Email.sendRentalStartedEmail({
        to: prefs.email,
        renterName: params.renterName ?? "Renter",
        listerName: params.listerName ?? "Lister",
        listingTitle: params.listingTitle,
        rentalUnits: params.rentalUnits ?? 1,
        pricingPeriod: params.pricingPeriod ?? "day",
        rentalEndsAt: new Date(params.rentalEndsAt).toLocaleString(),
        bookingId: params.bookingId,
      });
    }
  } catch (e) {
    console.error("Email error in notifyRentalStarted:", e);
  }

  return result;
}

export async function notifyItemReturned(params: {
  listerId: string;
  renterName: string;
  listingTitle: string;
  bookingId: string;
  isLate: boolean;
  listerName?: string;
}) {
  const result = await sendNotification({
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

  try {
    const prefs = await getUserEmailPrefs(params.listerId);
    if (prefs.email && prefs.emailBookings) {
      void Email.sendItemReturnedEmail({
        to: prefs.email,
        listerName: params.listerName ?? "Lister",
        renterName: params.renterName,
        listingTitle: params.listingTitle,
        isLate: params.isLate,
        returnedAt: new Date().toLocaleString(),
        bookingId: params.bookingId,
      });
    }
  } catch (e) {
    console.error("Email error in notifyItemReturned:", e);
  }

  return result;
}

export async function notifyDisputeRaised(params: {
  otherPartyId: string;
  adminIds: string[];
  listingTitle: string;
  bookingId: string;
  raisedByName: string;
  amount: number;
  otherPartyName?: string;
  disputeReason?: string;
  otherPartyRole?: "renter" | "lister";
}) {
  await Promise.all([
    sendNotification({
      userId: params.otherPartyId,
      type: "dispute_raised",
      title: "Dispute raised on your booking",
      body:
        `${params.raisedByName} raised a dispute on the booking for ` +
        `"${params.listingTitle}". An admin will review it shortly.`,
      actionUrl:
        params.otherPartyRole === "lister"
          ? `/lister/bookings/${params.bookingId}`
          : `/renter/rentals/${params.bookingId}`,
      bookingId: params.bookingId,
    }),
    ...params.adminIds.map((adminId) =>
      sendNotification({
        userId: adminId,
        type: "dispute_raised",
        title: `Dispute requires review - $${params.amount} at stake`,
        body:
          `${params.raisedByName} raised a dispute on booking ` +
          `for "${params.listingTitle}".`,
        actionUrl: `/admin/bookings/${params.bookingId}`,
        bookingId: params.bookingId,
      }),
    ),
  ]);

  try {
    const prefs = await getUserEmailPrefs(params.otherPartyId);
    if (prefs.email) {
      void Email.sendDisputeRaisedEmail({
        to: prefs.email,
        recipientName: params.otherPartyName ?? "User",
        raisedByName: params.raisedByName,
        listingTitle: params.listingTitle,
        disputeReason: params.disputeReason ?? "",
        bookingId: params.bookingId,
        recipientRole: params.otherPartyRole ?? "renter",
      });
    }
  } catch (e) {
    console.error("Email error in notifyDisputeRaised:", e);
  }
}

export async function notifyDisputeResolved(params: {
  renterId: string;
  listerId: string;
  renterAmount: number;
  listerAmount: number;
  bookingId: string;
  resolutionType: string;
  renterName?: string;
  listerName?: string;
  listingTitle?: string;
  resolutionNotes?: string;
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

  try {
    const [renterPrefs, listerPrefs] = await Promise.all([
      getUserEmailPrefs(params.renterId),
      getUserEmailPrefs(params.listerId),
    ]);

    if (renterPrefs.email) {
      void Email.sendDisputeResolvedEmail({
        to: renterPrefs.email,
        recipientName: params.renterName ?? "Renter",
        role: "renter",
        listingTitle: params.listingTitle ?? "",
        outcome: params.renterAmount > 0 ? "refund" : "none",
        amount: params.renterAmount,
        resolutionNotes: params.resolutionNotes ?? "",
        bookingId: params.bookingId,
      });
    }

    if (listerPrefs.email) {
      void Email.sendDisputeResolvedEmail({
        to: listerPrefs.email,
        recipientName: params.listerName ?? "Lister",
        role: "lister",
        listingTitle: params.listingTitle ?? "",
        outcome: params.listerAmount > 0 ? "payout" : "none",
        amount: params.listerAmount,
        resolutionNotes: params.resolutionNotes ?? "",
        bookingId: params.bookingId,
      });
    }
  } catch (e) {
    console.error("Email error in notifyDisputeResolved:", e);
  }
}

export async function notifyListerConfirmationWarning(params: {
  listerId: string;
  listerName?: string;
  listingTitle: string;
  renterName?: string;
  hoursRemaining: number;
  deadline: string;
  bookingId: string;
}) {
  const result = await sendNotification({
    userId: params.listerId,
    type: "booking_confirmation_required",
    title:
      params.hoursRemaining <= 2
        ? "Urgent: confirm booking within 2 hours"
        : "Reminder: confirm booking within 12 hours",
    body:
      `${params.listingTitle} must be confirmed by ${params.deadline} ` +
      "or it will auto-cancel.",
    bookingId: params.bookingId,
    actionUrl: `/lister/bookings/${params.bookingId}`,
    metadata: {
      reminder_window: `${params.hoursRemaining}h`,
    },
  });

  try {
    const prefs = await getUserEmailPrefs(params.listerId);
    if (prefs.email) {
      void Email.sendConfirmationDeadlineWarningEmail({
        to: prefs.email,
        listerName: params.listerName ?? "Lister",
        listingTitle: params.listingTitle,
        renterName: params.renterName ?? "Renter",
        hoursRemaining: params.hoursRemaining,
        deadline: params.deadline,
        bookingId: params.bookingId,
      });
    }
  } catch (e) {
    console.error("Email error in notifyListerConfirmationWarning:", e);
  }

  return result;
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
    title: "KYC verified!",
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
