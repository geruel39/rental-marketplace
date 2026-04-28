import { Section, Text } from "@react-email/components";
import {
  BaseLayout,
  EmailButton,
  EmailHeading,
  EmailInfoBox,
  EmailText,
} from "./base-layout";

interface WelcomeEmailProps {
  displayName: string;
  accountType: "individual" | "business";
  verifyUrl: string;
}

export default function WelcomeEmail({
  displayName,
  accountType,
  verifyUrl,
}: WelcomeEmailProps) {
  return (
    <BaseLayout preview={`Welcome to RentHub, ${displayName}!`}>
      <EmailHeading>Welcome to RentHub! 🎉</EmailHeading>
      <EmailText>Hi {displayName},</EmailText>
      <EmailText>
        You&apos;ve successfully created your{" "}
        {accountType === "business" ? "business" : ""} account. RentHub lets
        you rent items from others and earn by renting out your own belongings.
      </EmailText>

      <EmailInfoBox type="info">
        <Text style={{ margin: 0, fontWeight: "600", fontSize: "14px" }}>
          Want to start listing items?
        </Text>
        <Text style={{ margin: "4px 0 0 0", fontSize: "13px" }}>
          {accountType === "individual"
            ? "Complete identity verification (Gov ID + Selfie) to create listings."
            : "Complete business verification to create listings."}
        </Text>
      </EmailInfoBox>

      <Section style={{ textAlign: "center", margin: "24px 0" }}>
        <EmailButton href={verifyUrl}>
          {accountType === "individual"
            ? "Complete Verification"
            : "Complete Business Verification"}
        </EmailButton>
      </Section>

      <EmailText muted>
        You can also browse and rent items right away — no verification needed
        to rent.
      </EmailText>
    </BaseLayout>
  );
}
