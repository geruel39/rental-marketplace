import { Link, Section, Text } from "@react-email/components";
import {
  BaseLayout,
  EmailBookingSummary,
  EmailButton,
  EmailHeading,
  EmailInfoBox,
  EmailText,
} from "./base-layout";

interface BookingCancelledEmailProps {
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
  bookingUrl: string;
}

export default function BookingCancelledEmail(
  props: BookingCancelledEmailProps,
) {
  const isFullRefund = props.refundAmount >= props.totalPrice;
  const isNoRefund = props.refundAmount === 0;
  const cancellerLabel =
    props.cancelledByRole === "system"
      ? "automatically (confirmation deadline passed)"
      : `by ${props.cancelledByName}`;

  return (
    <BaseLayout preview={`Booking cancelled for ${props.listingTitle}`}>
      <EmailHeading>❌ Booking Cancelled</EmailHeading>
      <EmailText>Hi {props.recipientName},</EmailText>
      <EmailText>
        Your booking for <strong>{props.listingTitle}</strong> has been
        cancelled {cancellerLabel}.
        {props.reason ? ` Reason: ${props.reason}` : ""}
      </EmailText>

      <EmailBookingSummary
        booking={{
          listingTitle: props.listingTitle,
          rentalUnits: props.rentalUnits,
          pricingPeriod: props.pricingPeriod,
          quantity: 1,
          totalPrice: props.totalPrice,
        }}
      />

      <EmailInfoBox
        type={isFullRefund ? "success" : isNoRefund ? "warning" : "info"}
      >
        {isFullRefund && (
          <Text style={{ margin: 0, fontSize: "14px" }}>
            💰 <strong>Full Refund:</strong> SGD $
            {props.refundAmount.toFixed(2)} will be returned to your original
            payment method within 5-10 business days.
          </Text>
        )}
        {!isFullRefund && !isNoRefund && (
          <Text style={{ margin: 0, fontSize: "14px" }}>
            💰 <strong>Partial Refund ({props.refundPercent}%):</strong> SGD $
            {props.refundAmount.toFixed(2)} will be returned to your original
            payment method within 5-10 business days.
          </Text>
        )}
        {isNoRefund && (
          <Text style={{ margin: 0, fontSize: "14px" }}>
            ⚠️ <strong>No Refund:</strong> Based on our cancellation policy, no
            refund is applicable for this cancellation.{" "}
            <Link
              href={`${process.env.NEXT_PUBLIC_APP_URL}/policies#cancellation-policy`}
            >
              View policy
            </Link>
          </Text>
        )}
      </EmailInfoBox>

      <Section style={{ textAlign: "center", margin: "24px 0" }}>
        <EmailButton href={`${process.env.NEXT_PUBLIC_APP_URL}/listings`}>
          Browse Other Items
        </EmailButton>
      </Section>
    </BaseLayout>
  );
}
