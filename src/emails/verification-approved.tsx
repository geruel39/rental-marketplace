import { Section, Text } from "@react-email/components";
import {
  BaseLayout,
  EmailButton,
  EmailHeading,
  EmailText,
} from "./base-layout";

interface VerificationApprovedEmailProps {
  displayName: string;
  accountType: "individual" | "business";
  createListingUrl: string;
}

export default function VerificationApprovedEmail(
  props: VerificationApprovedEmailProps,
) {
  return (
    <BaseLayout preview="Your verification has been approved — start listing now!">
      <EmailHeading>✅ Verification Approved!</EmailHeading>
      <EmailText>Hi {props.displayName},</EmailText>
      <EmailText>
        Great news! Your{" "}
        {props.accountType === "business" ? "business " : "identity "}
        verification has been reviewed and approved by our team.
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
        <Text style={{ fontSize: "40px", margin: "0 0 8px 0" }}>🎉</Text>
        <Text
          style={{
            fontWeight: "700",
            fontSize: "18px",
            color: "#16a34a",
            margin: 0,
          }}
        >
          You can now create listings!
        </Text>
      </Section>

      <EmailText>
        You are now a verified lister on RentHub. Start creating listings to
        earn by renting out your items.
      </EmailText>

      <Section style={{ textAlign: "center", margin: "24px 0" }}>
        <EmailButton href={props.createListingUrl}>
          🚀 Create Your First Listing
        </EmailButton>
      </Section>
    </BaseLayout>
  );
}
