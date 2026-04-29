import type { ReactElement } from "react";
import { render } from "@react-email/render";
import { Resend } from "resend";

import BookingCancelledEmail from "@/emails/booking-cancelled";
import BookingConfirmationRequiredEmail from "@/emails/booking-confirmation-required";
import BookingConfirmedEmail from "@/emails/booking-confirmed";
import ConfirmationDeadlineWarningEmail from "@/emails/confirmation-deadline-warning";
import DisputeRaisedEmail from "@/emails/dispute-raised";
import DisputeResolvedEmail from "@/emails/dispute-resolved";
import ItemReturnedEmail from "@/emails/item-returned";
import PayoutFailedEmail from "@/emails/payout-failed";
import PayoutProcessedEmail from "@/emails/payout-processed";
import PaymentConfirmedEmail from "@/emails/payment-confirmed";
import RefundInitiatedEmail from "@/emails/refund-initiated";
import RentalCompletedEmail from "@/emails/rental-completed";
import RentalStartedEmail from "@/emails/rental-started";
import ReviewReceivedEmail from "@/emails/review-received";
import VerificationApprovedEmail from "@/emails/verification-approved";
import VerificationRejectedEmail from "@/emails/verification-rejected";
import WelcomeEmail from "@/emails/welcome";

const FROM = `${process.env.RESEND_FROM_NAME ?? "RentHub"} <${process.env.RESEND_FROM_EMAIL ?? "noreply@renthub.com"}>`;

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

interface SendEmailParams {
  to: string;
  subject: string;
  react: ReactElement;
}

function getResendClient() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return null;
  }

  return new Resend(apiKey);
}

async function sendEmail({
  to,
  subject,
  react,
}: SendEmailParams): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    console.warn("RESEND_API_KEY not configured - skipping email:", subject);
    return;
  }

  try {
    const resend = getResendClient();
    if (!resend) {
      console.warn("RESEND_API_KEY not configured - skipping email:", subject);
      return;
    }

    const html = await render(react);

    const { error } = await resend.emails.send({
      from: FROM,
      to,
      subject,
      html,
    });

    if (error) {
      console.error("Email send failed:", subject, "to:", to, "error:", error);
    } else {
      console.log("Email sent:", subject, "to:", to);
    }
  } catch (error) {
    console.error("Email service error:", error);
  }
}

export async function sendWelcomeEmail(params: {
  to: string;
  displayName: string;
  accountType: "individual" | "business";
}) {
  await sendEmail({
    to: params.to,
    subject: `Welcome to RentHub, ${params.displayName}!`,
    react: WelcomeEmail({
      displayName: params.displayName,
      accountType: params.accountType,
      verifyUrl: `${APP_URL}/account/verify`,
    }),
  });
}

export async function sendBookingConfirmationRequiredEmail(params: {
  to: string;
  listerName: string;
  renterName: string;
  listingTitle: string;
  rentalUnits: number;
  pricingPeriod: string;
  quantity: number;
  totalPrice: number;
  deadline: string;
  bookingId: string;
}) {
  await sendEmail({
    to: params.to,
    subject: `⏰ New booking for "${params.listingTitle}" — confirm by ${params.deadline}`,
    react: BookingConfirmationRequiredEmail({
      listerName: params.listerName,
      renterName: params.renterName,
      listingTitle: params.listingTitle,
      rentalUnits: params.rentalUnits,
      pricingPeriod: params.pricingPeriod,
      quantity: params.quantity,
      totalPrice: params.totalPrice,
      deadline: params.deadline,
      bookingUrl: `${APP_URL}/lister/bookings/${params.bookingId}`,
      confirmUrl: `${APP_URL}/lister/bookings/${params.bookingId}`,
    }),
  });
}

export async function sendBookingConfirmedEmail(params: {
  to: string;
  renterName: string;
  listerName: string;
  listingTitle: string;
  rentalUnits: number;
  pricingPeriod: string;
  quantity: number;
  totalPrice: number;
  bookingId: string;
}) {
  await sendEmail({
    to: params.to,
    subject: `✅ Booking confirmed — ${params.listingTitle}`,
    react: BookingConfirmedEmail({
      renterName: params.renterName,
      listerName: params.listerName,
      listingTitle: params.listingTitle,
      rentalUnits: params.rentalUnits,
      pricingPeriod: params.pricingPeriod,
      quantity: params.quantity,
      totalPrice: params.totalPrice,
      bookingUrl: `${APP_URL}/renter/rentals/${params.bookingId}`,
      messagesUrl: `${APP_URL}/account/messages`,
    }),
  });
}

export async function sendBookingCancelledEmail(params: {
  to: string;
  recipientName: string;
  cancelledByName: string;
  cancelledByRole: "renter" | "lister" | "system";
  listingTitle: string;
  rentalUnits: number;
  pricingPeriod: string;
  totalPrice: number;
  refundAmount: number;
  refundPercent: number;
  reason?: string;
  bookingId: string;
  recipientRole: "renter" | "lister";
}) {
  const bookingUrl =
    params.recipientRole === "renter"
      ? `${APP_URL}/renter/rentals/${params.bookingId}`
      : `${APP_URL}/lister/bookings/${params.bookingId}`;

  await sendEmail({
    to: params.to,
    subject: `Booking cancelled — ${params.listingTitle}`,
    react: BookingCancelledEmail({
      recipientName: params.recipientName,
      cancelledByName: params.cancelledByName,
      cancelledByRole: params.cancelledByRole,
      listingTitle: params.listingTitle,
      rentalUnits: params.rentalUnits,
      pricingPeriod: params.pricingPeriod,
      totalPrice: params.totalPrice,
      refundAmount: params.refundAmount,
      refundPercent: params.refundPercent,
      reason: params.reason,
      bookingUrl,
    }),
  });
}

export async function sendPaymentConfirmedEmail(params: {
  to: string;
  recipientName: string;
  role: "renter" | "lister";
  listingTitle: string;
  rentalUnits: number;
  pricingPeriod: string;
  quantity: number;
  amountPaid?: number;
  payoutAmount?: number;
  paymentReference: string;
  bookingId: string;
}) {
  const subject =
    params.role === "renter"
      ? `💳 Payment confirmed — ${params.listingTitle}`
      : `💰 Payment received — ${params.listingTitle}`;

  const bookingUrl =
    params.role === "renter"
      ? `${APP_URL}/renter/rentals/${params.bookingId}`
      : `${APP_URL}/lister/bookings/${params.bookingId}`;

  await sendEmail({
    to: params.to,
    subject,
    react: PaymentConfirmedEmail({
      recipientName: params.recipientName,
      role: params.role,
      listingTitle: params.listingTitle,
      rentalUnits: params.rentalUnits,
      pricingPeriod: params.pricingPeriod,
      quantity: params.quantity,
      amountPaid: params.amountPaid,
      payoutAmount: params.payoutAmount,
      paymentReference: params.paymentReference,
      bookingUrl,
    }),
  });
}

export async function sendPayoutProcessedEmail(params: {
  to: string;
  listerName: string;
  amount: number;
  payoutMethod: string;
  reference?: string;
  listingTitle: string;
  bookingId: string;
}) {
  await sendEmail({
    to: params.to,
    subject: `💸 Payout of SGD $${params.amount.toFixed(2)} sent!`,
    react: PayoutProcessedEmail({
      listerName: params.listerName,
      amount: params.amount,
      payoutMethod: params.payoutMethod,
      reference: params.reference,
      listingTitle: params.listingTitle,
      bookingUrl: `${APP_URL}/lister/bookings/${params.bookingId}`,
      earningsUrl: `${APP_URL}/lister/earnings`,
    }),
  });
}

export async function sendPayoutFailedEmail(params: {
  to: string;
  listerName: string;
  amount: number;
  reason: string;
}) {
  await sendEmail({
    to: params.to,
    subject: `⚠️ Action required: Payout of SGD $${params.amount.toFixed(2)} failed`,
    react: PayoutFailedEmail({
      listerName: params.listerName,
      amount: params.amount,
      reason: params.reason,
      updateSettingsUrl: `${APP_URL}/lister/settings/payments`,
      retryUrl: `${APP_URL}/lister/earnings`,
    }),
  });
}

export async function sendRefundInitiatedEmail(params: {
  to: string;
  renterName: string;
  refundAmount: number;
  originalAmount: number;
  reason: string;
  listingTitle: string;
  bookingId: string;
}) {
  await sendEmail({
    to: params.to,
    subject: `↩️ Refund of SGD $${params.refundAmount.toFixed(2)} initiated`,
    react: RefundInitiatedEmail({
      renterName: params.renterName,
      refundAmount: params.refundAmount,
      originalAmount: params.originalAmount,
      reason: params.reason,
      listingTitle: params.listingTitle,
      bookingUrl: `${APP_URL}/renter/rentals/${params.bookingId}`,
    }),
  });
}

export async function sendRentalStartedEmail(params: {
  to: string;
  renterName: string;
  listerName: string;
  listingTitle: string;
  rentalUnits: number;
  pricingPeriod: string;
  rentalEndsAt: string;
  bookingId: string;
}) {
  await sendEmail({
    to: params.to,
    subject: `🚀 Rental started — return by ${params.rentalEndsAt}`,
    react: RentalStartedEmail({
      renterName: params.renterName,
      listerName: params.listerName,
      listingTitle: params.listingTitle,
      rentalUnits: params.rentalUnits,
      pricingPeriod: params.pricingPeriod,
      rentalEndsAt: params.rentalEndsAt,
      bookingUrl: `${APP_URL}/renter/rentals/${params.bookingId}`,
    }),
  });
}

export async function sendItemReturnedEmail(params: {
  to: string;
  listerName: string;
  renterName: string;
  listingTitle: string;
  isLate: boolean;
  returnedAt: string;
  bookingId: string;
}) {
  await sendEmail({
    to: params.to,
    subject: params.isLate
      ? `⚠️ Item returned (late) — ${params.listingTitle}`
      : `📦 Item returned — ${params.listingTitle}`,
    react: ItemReturnedEmail({
      listerName: params.listerName,
      renterName: params.renterName,
      listingTitle: params.listingTitle,
      isLate: params.isLate,
      returnedAt: params.returnedAt,
      inspectUrl: `${APP_URL}/lister/bookings/${params.bookingId}`,
    }),
  });
}

export async function sendRentalCompletedEmail(params: {
  to: string;
  recipientName: string;
  role: "renter" | "lister";
  listingTitle: string;
  otherPartyName: string;
  bookingId: string;
}) {
  const bookingUrl =
    params.role === "renter"
      ? `${APP_URL}/renter/rentals/${params.bookingId}`
      : `${APP_URL}/lister/bookings/${params.bookingId}`;

  await sendEmail({
    to: params.to,
    subject: "🎉 Rental completed — leave a review!",
    react: RentalCompletedEmail({
      recipientName: params.recipientName,
      role: params.role,
      listingTitle: params.listingTitle,
      otherPartyName: params.otherPartyName,
      reviewUrl: bookingUrl,
      bookingUrl,
    }),
  });
}

export async function sendReviewReceivedEmail(params: {
  to: string;
  recipientName: string;
  reviewerName: string;
  rating: number;
  comment?: string;
  listingTitle: string;
}) {
  await sendEmail({
    to: params.to,
    subject: `⭐ ${params.reviewerName} left you a ${params.rating}-star review`,
    react: ReviewReceivedEmail({
      recipientName: params.recipientName,
      reviewerName: params.reviewerName,
      rating: params.rating,
      comment: params.comment,
      listingTitle: params.listingTitle,
      reviewsUrl: `${APP_URL}/dashboard/reviews`,
    }),
  });
}

export async function sendVerificationApprovedEmail(params: {
  to: string;
  displayName: string;
  accountType: "individual" | "business";
}) {
  await sendEmail({
    to: params.to,
    subject: "✅ Verification approved — start listing now!",
    react: VerificationApprovedEmail({
      displayName: params.displayName,
      accountType: params.accountType,
      createListingUrl: `${APP_URL}/lister/listings/new`,
    }),
  });
}

export async function sendVerificationRejectedEmail(params: {
  to: string;
  displayName: string;
  reason: string;
  rejectedItems: string[];
}) {
  await sendEmail({
    to: params.to,
    subject: "⚠️ Verification update — action required",
    react: VerificationRejectedEmail({
      displayName: params.displayName,
      reason: params.reason,
      rejectedItems: params.rejectedItems,
      resubmitUrl: `${APP_URL}/account/verify`,
    }),
  });
}

export async function sendDisputeRaisedEmail(params: {
  to: string;
  recipientName: string;
  raisedByName: string;
  listingTitle: string;
  disputeReason: string;
  bookingId: string;
  recipientRole: "renter" | "lister";
}) {
  const bookingUrl =
    params.recipientRole === "renter"
      ? `${APP_URL}/renter/rentals/${params.bookingId}`
      : `${APP_URL}/lister/bookings/${params.bookingId}`;

  await sendEmail({
    to: params.to,
    subject: `🚨 Dispute raised — ${params.listingTitle}`,
    react: DisputeRaisedEmail({
      recipientName: params.recipientName,
      raisedByName: params.raisedByName,
      listingTitle: params.listingTitle,
      disputeReason: params.disputeReason,
      bookingUrl,
    }),
  });
}

export async function sendDisputeResolvedEmail(params: {
  to: string;
  recipientName: string;
  role: "renter" | "lister";
  listingTitle: string;
  outcome: "refund" | "payout" | "none";
  amount: number;
  resolutionNotes: string;
  bookingId: string;
}) {
  const bookingUrl =
    params.role === "renter"
      ? `${APP_URL}/renter/rentals/${params.bookingId}`
      : `${APP_URL}/lister/bookings/${params.bookingId}`;

  await sendEmail({
    to: params.to,
    subject: `🔍 Dispute resolved — ${params.listingTitle}`,
    react: DisputeResolvedEmail({
      recipientName: params.recipientName,
      role: params.role,
      listingTitle: params.listingTitle,
      outcome: params.outcome,
      amount: params.amount,
      resolutionNotes: params.resolutionNotes,
      bookingUrl,
    }),
  });
}

export async function sendConfirmationDeadlineWarningEmail(params: {
  to: string;
  listerName: string;
  listingTitle: string;
  renterName: string;
  hoursRemaining: number;
  deadline: string;
  bookingId: string;
}) {
  const isUrgent = params.hoursRemaining <= 2;

  await sendEmail({
    to: params.to,
    subject: isUrgent
      ? `🔴 URGENT: ${params.hoursRemaining}hr(s) left to confirm booking!`
      : `⚠️ Reminder: Confirm booking for "${params.listingTitle}"`,
    react: ConfirmationDeadlineWarningEmail({
      listerName: params.listerName,
      listingTitle: params.listingTitle,
      renterName: params.renterName,
      hoursRemaining: params.hoursRemaining,
      deadline: params.deadline,
      confirmUrl: `${APP_URL}/lister/bookings/${params.bookingId}`,
      cancelUrl: `${APP_URL}/lister/bookings/${params.bookingId}`,
    }),
  });
}
