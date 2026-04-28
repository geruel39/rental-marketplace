import { Section, Text } from "@react-email/components";
import {
  BaseLayout,
  EmailButton,
  EmailHeading,
  EmailInfoBox,
  EmailText,
} from "./base-layout";

interface DisputeRaisedEmailProps {
  recipientName: string;
  raisedByName: string;
  listingTitle: string;
  disputeReason: string;
  bookingUrl: string;
}

export default function DisputeRaisedEmail(props: DisputeRaisedEmailProps) {
  return (
    <BaseLayout
      preview={`A dispute has been raised on your booking for ${props.listingTitle}`}
    >
      <EmailHeading>🚨 Dispute Raised</EmailHeading>
      <EmailText>Hi {props.recipientName},</EmailText>
      <EmailText>
        <strong>{props.raisedByName}</strong> has raised a dispute on the
        booking for <strong>{props.listingTitle}</strong>.
      </EmailText>

      <EmailInfoBox type="warning">
        <Text style={{ margin: "0 0 4px 0", fontWeight: "600", fontSize: "14px" }}>
          Reason stated:
        </Text>
        <Text style={{ margin: 0, fontSize: "13px", fontStyle: "italic" }}>
          &quot;{props.disputeReason}&quot;
        </Text>
      </EmailInfoBox>

      <EmailText>
        Payment for this booking is being held while our admin team reviews the
        dispute. We aim to resolve all disputes within 3-5 business days.
      </EmailText>

      <EmailText muted>
        Our team will review all evidence including handover photos, return
        photos, and message history. Please ensure your communication and proof
        photos are available in the app.
      </EmailText>

      <Section style={{ textAlign: "center", margin: "24px 0" }}>
        <EmailButton href={props.bookingUrl}>View Booking Details</EmailButton>
      </Section>
    </BaseLayout>
  );
}
