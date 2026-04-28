import { Section, Text } from "@react-email/components";
import {
  BaseLayout,
  EmailButton,
  EmailHeading,
  EmailText,
} from "./base-layout";

interface PayoutProcessedEmailProps {
  listerName: string;
  amount: number;
  payoutMethod: string;
  reference?: string;
  listingTitle: string;
  bookingUrl: string;
  earningsUrl: string;
}

export default function PayoutProcessedEmail(
  props: PayoutProcessedEmailProps,
) {
  return (
    <BaseLayout
      preview={`Your payout of SGD $${props.amount.toFixed(2)} has been sent!`}
    >
      <EmailHeading>💸 Payout Sent!</EmailHeading>
      <EmailText>Hi {props.listerName},</EmailText>
      <EmailText>
        Your payout has been processed and sent to your{" "}
        <strong>{props.payoutMethod}</strong> account.
      </EmailText>

      <Section
        style={{
          backgroundColor: "#f0fdf4",
          border: "1px solid #bbf7d0",
          borderRadius: "8px",
          padding: "20px",
          margin: "16px 0",
          textAlign: "center",
        }}
      >
        <Text
          style={{
            fontSize: "32px",
            fontWeight: "700",
            color: "#16a34a",
            margin: 0,
          }}
        >
          SGD ${props.amount.toFixed(2)}
        </Text>
        <Text
          style={{
            fontSize: "14px",
            color: "#15803d",
            margin: "4px 0 0 0",
          }}
        >
          sent to your {props.payoutMethod}
        </Text>
      </Section>

      {props.reference && (
        <EmailText muted>Reference number: {props.reference}</EmailText>
      )}

      <EmailText muted>For: {props.listingTitle}</EmailText>

      <Section style={{ textAlign: "center", margin: "24px 0" }}>
        <EmailButton href={props.earningsUrl}>View Earnings History</EmailButton>
      </Section>
    </BaseLayout>
  );
}
