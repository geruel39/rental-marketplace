import { Section, Text } from "@react-email/components";
import {
  BaseLayout,
  EmailButton,
  EmailHeading,
  EmailInfoBox,
  EmailText,
} from "./base-layout";

interface PayoutFailedEmailProps {
  listerName: string;
  amount: number;
  reason: string;
  updateSettingsUrl: string;
  retryUrl: string;
}

export default function PayoutFailedEmail(props: PayoutFailedEmailProps) {
  return (
    <BaseLayout
      preview={`Action required: Your payout of SGD $${props.amount.toFixed(2)} failed`}
    >
      <EmailHeading>⚠️ Payout Failed</EmailHeading>
      <EmailText>Hi {props.listerName},</EmailText>
      <EmailText>
        We were unable to process your payout of{" "}
        <strong>SGD ${props.amount.toFixed(2)}</strong>.
      </EmailText>

      <EmailInfoBox type="danger">
        <Text style={{ margin: 0, fontWeight: "600", fontSize: "14px" }}>
          Reason: {props.reason}
        </Text>
        <Text style={{ margin: "4px 0 0 0", fontSize: "13px" }}>
          Please update your payout settings and request a retry.
        </Text>
      </EmailInfoBox>

      <Section style={{ textAlign: "center", margin: "24px 0" }}>
        <EmailButton href={props.updateSettingsUrl}>
          Update Payout Settings
        </EmailButton>
        <br />
        <EmailButton href={props.retryUrl} variant="secondary">
          Request Retry
        </EmailButton>
      </Section>

      <EmailText muted>
        Your earnings are safe and will be held until the payout is
        successfully processed.
      </EmailText>
    </BaseLayout>
  );
}
