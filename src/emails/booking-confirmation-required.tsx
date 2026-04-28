import { Section, Text } from "@react-email/components";
import {
  BaseLayout,
  EmailBookingSummary,
  EmailButton,
  EmailHeading,
  EmailInfoBox,
  EmailText,
} from "./base-layout";

interface BookingConfirmationRequiredEmailProps {
  listerName: string;
  renterName: string;
  listingTitle: string;
  rentalUnits: number;
  pricingPeriod: string;
  quantity: number;
  totalPrice: number;
  deadline: string;
  bookingUrl: string;
  confirmUrl: string;
}

export default function BookingConfirmationRequiredEmail(
  props: BookingConfirmationRequiredEmailProps,
) {
  return (
    <BaseLayout
      preview={`New booking for ${props.listingTitle} — confirm by ${props.deadline}`}
    >
      <EmailHeading>🔔 New Booking — Confirm Required</EmailHeading>
      <EmailText>Hi {props.listerName},</EmailText>
      <EmailText>
        <strong>{props.renterName}</strong> has booked your item and completed
        payment. You need to confirm you can fulfill this booking.
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

      <EmailInfoBox type="warning">
        <Text style={{ margin: 0, fontWeight: "700", fontSize: "14px" }}>
          ⏰ Confirm by: {props.deadline}
        </Text>
        <Text style={{ margin: "4px 0 0 0", fontSize: "13px" }}>
          If you do not confirm within 24 hours, the booking will be
          automatically cancelled and the renter will receive a full refund.
          Your listing will also be paused.
        </Text>
      </EmailInfoBox>

      <Section style={{ textAlign: "center", margin: "24px 0" }}>
        <EmailButton href={props.confirmUrl}>
          ✅ Confirm I Can Fulfill This
        </EmailButton>
        <br />
        <EmailButton href={props.bookingUrl} variant="secondary">
          View Booking Details
        </EmailButton>
      </Section>

      <EmailText muted>
        If you cannot fulfill this booking, you can cancel it from the booking
        details page. Cancelling will result in a full refund to the renter and
        your listing will be paused.
      </EmailText>
    </BaseLayout>
  );
}
