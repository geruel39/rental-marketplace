import { Section, Text } from "@react-email/components";
import {
  BaseLayout,
  EmailButton,
  EmailHeading,
  EmailInfoBox,
  EmailText,
} from "./base-layout";

interface ConfirmationDeadlineWarningEmailProps {
  listerName: string;
  listingTitle: string;
  renterName: string;
  hoursRemaining: number;
  deadline: string;
  confirmUrl: string;
  cancelUrl: string;
}

export default function ConfirmationDeadlineWarningEmail(
  props: ConfirmationDeadlineWarningEmailProps,
) {
  const isUrgent = props.hoursRemaining <= 2;

  return (
    <BaseLayout
      preview={
        isUrgent
          ? `🔴 URGENT: ${props.hoursRemaining}hrs left to confirm booking!`
          : `⚠️ Reminder: ${props.hoursRemaining}hrs left to confirm booking`
      }
    >
      <EmailHeading>
        {isUrgent ? "🔴 Urgent: Confirm Now!" : "⏰ Confirmation Reminder"}
      </EmailHeading>
      <EmailText>Hi {props.listerName},</EmailText>
      <EmailText>
        {isUrgent ? `Only ${props.hoursRemaining} hour(s) left!` : "Reminder:"}{" "}
        You have a pending booking from <strong>{props.renterName}</strong> for{" "}
        <strong>{props.listingTitle}</strong> that needs your confirmation.
      </EmailText>

      <EmailInfoBox type={isUrgent ? "danger" : "warning"}>
        <Text style={{ margin: 0, fontWeight: "700", fontSize: "14px" }}>
          ⏰ Deadline: {props.deadline} ({props.hoursRemaining} hour(s)
          remaining)
        </Text>
        <Text style={{ margin: "4px 0 0 0", fontSize: "13px" }}>
          If you do not confirm, the booking will be automatically cancelled,
          the renter will receive a full refund, and your listing will be
          paused.
        </Text>
      </EmailInfoBox>

      <Section style={{ textAlign: "center", margin: "24px 0" }}>
        <EmailButton href={props.confirmUrl}>✅ Confirm Booking Now</EmailButton>
        <br />
        <EmailButton href={props.cancelUrl} variant="secondary">
          Cancel This Booking
        </EmailButton>
      </Section>
    </BaseLayout>
  );
}
