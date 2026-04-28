import { Section, Text } from "@react-email/components";
import {
  BaseLayout,
  EmailBookingSummary,
  EmailButton,
  EmailHeading,
  EmailInfoBox,
  EmailText,
} from "./base-layout";

interface BookingConfirmedEmailProps {
  renterName: string;
  listerName: string;
  listingTitle: string;
  rentalUnits: number;
  pricingPeriod: string;
  quantity: number;
  totalPrice: number;
  bookingUrl: string;
  messagesUrl: string;
}

export default function BookingConfirmedEmail(
  props: BookingConfirmedEmailProps,
) {
  return (
    <BaseLayout preview={`Booking confirmed for ${props.listingTitle}!`}>
      <EmailHeading>✅ Booking Confirmed!</EmailHeading>
      <EmailText>Hi {props.renterName},</EmailText>
      <EmailText>
        Great news! <strong>{props.listerName}</strong> has confirmed your
        booking. Contact them via messages to arrange item handover.
      </EmailText>

      <EmailBookingSummary
        booking={{
          listingTitle: props.listingTitle,
          rentalUnits: props.rentalUnits,
          pricingPeriod: props.pricingPeriod,
          quantity: props.quantity,
          totalPrice: props.totalPrice,
        }}
      />

      <EmailInfoBox type="success">
        <Text style={{ margin: 0, fontSize: "14px" }}>
          📦 <strong>Next step:</strong> Message {props.listerName} to arrange
          when and where to pick up the item. The rental clock starts when the
          lister confirms handover with a photo.
        </Text>
      </EmailInfoBox>

      <Section style={{ textAlign: "center", margin: "24px 0" }}>
        <EmailButton href={props.messagesUrl}>
          💬 Message {props.listerName}
        </EmailButton>
        <br />
        <EmailButton href={props.bookingUrl} variant="secondary">
          View Booking Details
        </EmailButton>
      </Section>
    </BaseLayout>
  );
}
