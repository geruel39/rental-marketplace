import { NextRequest, NextResponse } from "next/server";

import * as Email from "@/lib/email";

export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") ?? "welcome";
  const to = searchParams.get("to") ?? "";

  if (!to) {
    return NextResponse.json({ error: "Provide ?to=email&type=welcome" });
  }

  const testData = {
    welcome: () =>
      Email.sendWelcomeEmail({
        to,
        displayName: "Test User",
        accountType: "individual",
      }),
    booking_required: () =>
      Email.sendBookingConfirmationRequiredEmail({
        to,
        listerName: "Jane Lister",
        renterName: "John Renter",
        listingTitle: "DJI Drone",
        rentalUnits: 3,
        pricingPeriod: "day",
        quantity: 1,
        totalPrice: 150,
        deadline: new Date(
          Date.now() + 20 * 60 * 60 * 1000,
        ).toLocaleString(),
        bookingId: "test-booking-123",
      }),
    booking_confirmed: () =>
      Email.sendBookingConfirmedEmail({
        to,
        renterName: "John Renter",
        listerName: "Jane Lister",
        listingTitle: "DJI Drone",
        rentalUnits: 3,
        pricingPeriod: "day",
        quantity: 1,
        totalPrice: 150,
        bookingId: "test-booking-123",
      }),
    booking_cancelled: () =>
      Email.sendBookingCancelledEmail({
        to,
        recipientName: "John Renter",
        cancelledByName: "Jane Lister",
        cancelledByRole: "lister",
        listingTitle: "DJI Drone",
        rentalUnits: 3,
        pricingPeriod: "day",
        totalPrice: 150,
        refundAmount: 150,
        refundPercent: 100,
        reason: "Item is unavailable",
        bookingId: "test-booking-123",
        recipientRole: "renter",
      }),
    payment_confirmed: () =>
      Email.sendPaymentConfirmedEmail({
        to,
        recipientName: "John Renter",
        role: "renter",
        listingTitle: "DJI Drone",
        rentalUnits: 3,
        pricingPeriod: "day",
        quantity: 1,
        amountPaid: 157.5,
        paymentReference: "HP-12345",
        bookingId: "test-booking-123",
      }),
    payout: () =>
      Email.sendPayoutProcessedEmail({
        to,
        listerName: "Jane Lister",
        amount: 135,
        payoutMethod: "GCash",
        reference: "GC-98765",
        listingTitle: "DJI Drone",
        bookingId: "test-booking-123",
      }),
    payout_failed: () =>
      Email.sendPayoutFailedEmail({
        to,
        listerName: "Jane Lister",
        amount: 135,
        reason: "Invalid GCash number",
      }),
    refund: () =>
      Email.sendRefundInitiatedEmail({
        to,
        renterName: "John Renter",
        refundAmount: 150,
        originalAmount: 157.5,
        reason: "Lister cancelled",
        listingTitle: "DJI Drone",
        bookingId: "test-booking-123",
      }),
    rental_started: () =>
      Email.sendRentalStartedEmail({
        to,
        renterName: "John Renter",
        listerName: "Jane Lister",
        listingTitle: "DJI Drone",
        rentalUnits: 3,
        pricingPeriod: "day",
        rentalEndsAt: new Date(
          Date.now() + 3 * 24 * 60 * 60 * 1000,
        ).toLocaleString(),
        bookingId: "test-booking-123",
      }),
    item_returned: () =>
      Email.sendItemReturnedEmail({
        to,
        listerName: "Jane Lister",
        renterName: "John Renter",
        listingTitle: "DJI Drone",
        isLate: false,
        returnedAt: new Date().toLocaleString(),
        bookingId: "test-booking-123",
      }),
    completed: () =>
      Email.sendRentalCompletedEmail({
        to,
        recipientName: "John Renter",
        role: "renter",
        listingTitle: "DJI Drone",
        otherPartyName: "Jane Lister",
        bookingId: "test-booking-123",
      }),
    review: () =>
      Email.sendReviewReceivedEmail({
        to,
        recipientName: "Jane Lister",
        reviewerName: "John Renter",
        rating: 5,
        comment: "Great lister, highly recommend!",
        listingTitle: "DJI Drone",
      }),
    verified: () =>
      Email.sendVerificationApprovedEmail({
        to,
        displayName: "Jane Lister",
        accountType: "individual",
      }),
    rejected: () =>
      Email.sendVerificationRejectedEmail({
        to,
        displayName: "Jane Lister",
        reason: "ID photo is too blurry",
        rejectedItems: ["Government ID (Front)", "Selfie"],
      }),
    dispute_raised: () =>
      Email.sendDisputeRaisedEmail({
        to,
        recipientName: "Jane Lister",
        raisedByName: "John Renter",
        listingTitle: "DJI Drone",
        disputeReason: "Item was damaged on arrival",
        bookingId: "test-booking-123",
        recipientRole: "lister",
      }),
    dispute_resolved: () =>
      Email.sendDisputeResolvedEmail({
        to,
        recipientName: "John Renter",
        role: "renter",
        listingTitle: "DJI Drone",
        outcome: "refund",
        amount: 75,
        resolutionNotes: "Split decision - partial damage found",
        bookingId: "test-booking-123",
      }),
    deadline_warning: () =>
      Email.sendConfirmationDeadlineWarningEmail({
        to,
        listerName: "Jane Lister",
        listingTitle: "DJI Drone",
        renterName: "John Renter",
        hoursRemaining: 2,
        deadline: new Date(Date.now() + 2 * 60 * 60 * 1000).toLocaleString(),
        bookingId: "test-booking-123",
      }),
  };

  const sendFn = testData[type as keyof typeof testData];
  if (!sendFn) {
    return NextResponse.json({
      error: "Unknown type",
      available: Object.keys(testData),
    });
  }

  await sendFn();
  return NextResponse.json({ success: true, type, to });
}
