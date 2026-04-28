import { Section, Text } from "@react-email/components";
import {
  BaseLayout,
  EmailButton,
  EmailHeading,
  EmailInfoBox,
  EmailText,
} from "./base-layout";

interface RefundInitiatedEmailProps {
  renterName: string;
  refundAmount: number;
  originalAmount: number;
  reason: string;
  listingTitle: string;
  bookingUrl: string;
}

export default function RefundInitiatedEmail(
  props: RefundInitiatedEmailProps,
) {
  const isPartial = props.refundAmount < props.originalAmount;

  return (
    <BaseLayout
      preview={`Refund of SGD $${props.refundAmount.toFixed(2)} is being processed`}
    >
      <EmailHeading>↩️ Refund Initiated</EmailHeading>
      <EmailText>Hi {props.renterName},</EmailText>
      <EmailText>
        A refund for your rental of <strong>{props.listingTitle}</strong> is
        being processed.
      </EmailText>

      <Section
        style={{
          backgroundColor: "#f9fafb",
          borderRadius: "8px",
          padding: "16px 20px",
          margin: "16px 0",
        }}
      >
        <Text style={{ fontSize: "14px", color: "#374151", margin: "4px 0" }}>
          Original payment: SGD ${props.originalAmount.toFixed(2)}
        </Text>
        {isPartial && (
          <Text
            style={{ fontSize: "14px", color: "#374151", margin: "4px 0" }}
          >
            Cancellation fee: SGD $
            {(props.originalAmount - props.refundAmount).toFixed(2)}
          </Text>
        )}
        <Text
          style={{
            fontSize: "18px",
            fontWeight: "700",
            color: "#16a34a",
            margin: "8px 0 0 0",
          }}
        >
          Refund: SGD ${props.refundAmount.toFixed(2)}
        </Text>
      </Section>

      <EmailText muted>Reason: {props.reason}</EmailText>

      <EmailInfoBox type="info">
        <Text style={{ margin: 0, fontSize: "14px" }}>
          ⏱ Refunds typically appear within <strong>5-10 business days</strong>{" "}
          on your original payment method.
        </Text>
      </EmailInfoBox>

      <Section style={{ textAlign: "center", margin: "24px 0" }}>
        <EmailButton href={props.bookingUrl}>View Booking Details</EmailButton>
      </Section>
    </BaseLayout>
  );
}
