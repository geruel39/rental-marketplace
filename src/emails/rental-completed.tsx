import { Section, Text } from "@react-email/components";
import {
  BaseLayout,
  EmailButton,
  EmailHeading,
  EmailInfoBox,
  EmailText,
} from "./base-layout";

interface RentalCompletedEmailProps {
  recipientName: string;
  role: "renter" | "lister";
  listingTitle: string;
  otherPartyName: string;
  reviewUrl: string;
  bookingUrl: string;
}

export default function RentalCompletedEmail(
  props: RentalCompletedEmailProps,
) {
  return (
    <BaseLayout
      preview={`Rental completed — leave a review for ${props.otherPartyName}`}
    >
      <EmailHeading>🎉 Rental Completed!</EmailHeading>
      <EmailText>Hi {props.recipientName},</EmailText>
      <EmailText>
        The rental of <strong>{props.listingTitle}</strong> has been
        successfully completed.
      </EmailText>

      <EmailInfoBox type="info">
        <Text style={{ margin: 0, fontWeight: "600", fontSize: "14px" }}>
          ⭐ Share your experience
        </Text>
        <Text style={{ margin: "4px 0 0 0", fontSize: "13px" }}>
          Reviews help build trust in our community. Take a moment to rate your
          experience with {props.otherPartyName}.
        </Text>
      </EmailInfoBox>

      <Section style={{ textAlign: "center", margin: "24px 0" }}>
        <EmailButton href={props.reviewUrl}>Leave a Review</EmailButton>
        <br />
        <EmailButton href={props.bookingUrl} variant="secondary">
          View Booking Details
        </EmailButton>
      </Section>
    </BaseLayout>
  );
}
