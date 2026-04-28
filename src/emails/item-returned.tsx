import { Section, Text } from "@react-email/components";
import {
  BaseLayout,
  EmailButton,
  EmailHeading,
  EmailInfoBox,
  EmailText,
} from "./base-layout";

interface ItemReturnedEmailProps {
  listerName: string;
  renterName: string;
  listingTitle: string;
  isLate: boolean;
  returnedAt: string;
  inspectUrl: string;
}

export default function ItemReturnedEmail(props: ItemReturnedEmailProps) {
  return (
    <BaseLayout
      preview={`${props.renterName} has returned ${props.listingTitle}`}
    >
      <EmailHeading>
        {props.isLate ? "⚠️ Item Returned (Late)" : "📦 Item Returned"}
      </EmailHeading>
      <EmailText>Hi {props.listerName},</EmailText>
      <EmailText>
        <strong>{props.renterName}</strong> has marked the item as returned at{" "}
        {props.returnedAt}.
        {props.isLate ? " Note: The item was returned after the deadline." : ""}
      </EmailText>

      <EmailInfoBox type={props.isLate ? "warning" : "success"}>
        <Text style={{ margin: 0, fontSize: "14px" }}>
          <strong>Action required:</strong> Please inspect the item condition
          and complete the booking. Your payout will be processed after
          completion.
        </Text>
      </EmailInfoBox>

      <Section style={{ textAlign: "center", margin: "24px 0" }}>
        <EmailButton href={props.inspectUrl}>
          Inspect & Complete Booking
        </EmailButton>
      </Section>
    </BaseLayout>
  );
}
