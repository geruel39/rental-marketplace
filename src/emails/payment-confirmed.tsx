import { Section, Text } from "@react-email/components";
import {
  BaseLayout,
  EmailBookingSummary,
  EmailButton,
  EmailHeading,
  EmailInfoBox,
  EmailText,
} from "./base-layout";

interface PaymentConfirmedEmailProps {
  recipientName: string;
  role: "renter" | "lister";
  listingTitle: string;
  rentalUnits: number;
  pricingPeriod: string;
  quantity: number;
  amountPaid?: number;
  payoutAmount?: number;
  paymentReference: string;
  bookingUrl: string;
}

export default function PaymentConfirmedEmail(
  props: PaymentConfirmedEmailProps,
) {
  const isRenter = props.role === "renter";

  return (
    <BaseLayout
      preview={
        isRenter
          ? `Payment confirmed for ${props.listingTitle}`
          : `Payment received for ${props.listingTitle}`
      }
    >
      <EmailHeading>
        {isRenter ? "💳 Payment Confirmed!" : "💰 Payment Received!"}
      </EmailHeading>
      <EmailText>Hi {props.recipientName},</EmailText>

      {isRenter ? (
        <EmailText>
          Your payment for <strong>{props.listingTitle}</strong> has been
          confirmed. The lister has been notified and must confirm
          availability within 24 hours.
        </EmailText>
      ) : (
        <EmailText>
          Payment of <strong>SGD ${props.amountPaid?.toFixed(2)}</strong> has
          been received for <strong>{props.listingTitle}</strong>. Please
          confirm this booking within 24 hours.
        </EmailText>
      )}

      <EmailBookingSummary
        booking={{
          listingTitle: props.listingTitle,
          rentalUnits: props.rentalUnits,
          pricingPeriod: props.pricingPeriod,
          quantity: props.quantity,
          totalPrice: props.amountPaid ?? props.payoutAmount ?? 0,
        }}
      />

      {!isRenter && props.payoutAmount && (
        <EmailInfoBox type="success">
          <Text style={{ margin: 0, fontSize: "14px" }}>
            Your estimated payout:{" "}
            <strong>SGD ${props.payoutAmount.toFixed(2)}</strong> (after
            platform fees, processed after rental completion)
          </Text>
        </EmailInfoBox>
      )}

      <Section style={{ textAlign: "center", margin: "24px 0" }}>
        <EmailButton href={props.bookingUrl}>View Booking Details</EmailButton>
      </Section>

      <EmailText muted>Payment reference: {props.paymentReference}</EmailText>
    </BaseLayout>
  );
}
