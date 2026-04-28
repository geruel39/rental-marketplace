import { Section, Text } from "@react-email/components";
import {
  BaseLayout,
  EmailButton,
  EmailHeading,
  EmailInfoBox,
  EmailText,
} from "./base-layout";

interface DisputeResolvedEmailProps {
  recipientName: string;
  role: "renter" | "lister";
  listingTitle: string;
  outcome: "refund" | "payout" | "none";
  amount: number;
  resolutionNotes: string;
  bookingUrl: string;
}

export default function DisputeResolvedEmail(
  props: DisputeResolvedEmailProps,
) {
  return (
    <BaseLayout preview={`Dispute resolved for ${props.listingTitle}`}>
      <EmailHeading>🔍 Dispute Resolved</EmailHeading>
      <EmailText>Hi {props.recipientName},</EmailText>
      <EmailText>
        Our admin team has reviewed and resolved the dispute for{" "}
        <strong>{props.listingTitle}</strong>.
      </EmailText>

      <EmailInfoBox type={props.outcome === "none" ? "warning" : "success"}>
        {props.outcome === "refund" && (
          <Text style={{ margin: 0, fontSize: "14px" }}>
            💰 <strong>Outcome:</strong> You will receive a refund of{" "}
            <strong>SGD ${props.amount.toFixed(2)}</strong> within 5-10 business
            days.
          </Text>
        )}
        {props.outcome === "payout" && (
          <Text style={{ margin: 0, fontSize: "14px" }}>
            💰 <strong>Outcome:</strong> A payout of{" "}
            <strong>SGD ${props.amount.toFixed(2)}</strong> will be processed
            to your payout account.
          </Text>
        )}
        {props.outcome === "none" && (
          <Text style={{ margin: 0, fontSize: "14px" }}>
            <strong>Outcome:</strong> After review, no payment adjustment has
            been made.
          </Text>
        )}
      </EmailInfoBox>

      <EmailText muted>Admin notes: {props.resolutionNotes}</EmailText>

      <Section style={{ textAlign: "center", margin: "24px 0" }}>
        <EmailButton href={props.bookingUrl}>View Booking Details</EmailButton>
      </Section>
    </BaseLayout>
  );
}
