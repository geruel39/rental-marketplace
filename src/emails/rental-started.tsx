import { Section, Text } from "@react-email/components";
import {
  BaseLayout,
  EmailButton,
  EmailHeading,
  EmailInfoBox,
  EmailText,
} from "./base-layout";

interface RentalStartedEmailProps {
  renterName: string;
  listerName: string;
  listingTitle: string;
  rentalUnits: number;
  pricingPeriod: string;
  rentalEndsAt: string;
  bookingUrl: string;
}

export default function RentalStartedEmail(props: RentalStartedEmailProps) {
  return (
    <BaseLayout preview={`Your rental of ${props.listingTitle} has started!`}>
      <EmailHeading>🚀 Rental Period Started!</EmailHeading>
      <EmailText>Hi {props.renterName},</EmailText>
      <EmailText>
        <strong>{props.listerName}</strong> has confirmed that the item has
        been handed over. Your rental period is now officially running!
      </EmailText>

      <Section
        style={{
          backgroundColor: "#f0fdf4",
          border: "1px solid #bbf7d0",
          borderRadius: "8px",
          padding: "16px 20px",
          margin: "16px 0",
        }}
      >
        <Text
          style={{
            fontWeight: "600",
            fontSize: "14px",
            color: "#2e2e2f",
            margin: "0 0 8px 0",
          }}
        >
          📦 {props.listingTitle}
        </Text>
        <Text style={{ fontSize: "14px", color: "#374151", margin: "4px 0" }}>
          Duration: {props.rentalUnits} {props.pricingPeriod}(s)
        </Text>
        <Text
          style={{
            fontSize: "14px",
            fontWeight: "700",
            color: "#dc2626",
            margin: "8px 0 0 0",
          }}
        >
          ⏰ Return by: {props.rentalEndsAt}
        </Text>
      </Section>

      <EmailInfoBox type="warning">
        <Text style={{ margin: 0, fontSize: "14px" }}>
          When returning the item, upload proof photos through the app. Late
          returns may affect your renter rating.
        </Text>
      </EmailInfoBox>

      <Section style={{ textAlign: "center", margin: "24px 0" }}>
        <EmailButton href={props.bookingUrl}>View Rental Details</EmailButton>
      </Section>
    </BaseLayout>
  );
}
