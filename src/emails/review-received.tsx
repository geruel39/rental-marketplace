import { Section, Text } from "@react-email/components";
import {
  BaseLayout,
  EmailButton,
  EmailHeading,
  EmailText,
} from "./base-layout";

interface ReviewReceivedEmailProps {
  recipientName: string;
  reviewerName: string;
  rating: number;
  comment?: string;
  listingTitle: string;
  reviewsUrl: string;
}

export default function ReviewReceivedEmail(props: ReviewReceivedEmailProps) {
  const stars = "⭐".repeat(props.rating) + "☆".repeat(5 - props.rating);

  return (
    <BaseLayout
      preview={`${props.reviewerName} left you a ${props.rating}-star review`}
    >
      <EmailHeading>⭐ New Review Received</EmailHeading>
      <EmailText>Hi {props.recipientName},</EmailText>
      <EmailText>
        <strong>{props.reviewerName}</strong> left you a review for{" "}
        <strong>{props.listingTitle}</strong>.
      </EmailText>

      <Section
        style={{
          backgroundColor: "#f9fafb",
          borderRadius: "8px",
          padding: "20px",
          margin: "16px 0",
          textAlign: "center",
        }}
      >
        <Text style={{ fontSize: "28px", margin: "0 0 8px 0" }}>{stars}</Text>
        <Text
          style={{
            fontSize: "20px",
            fontWeight: "700",
            color: "#003e86",
            margin: 0,
          }}
        >
          {props.rating}/5 stars
        </Text>
        {props.comment && (
          <Text
            style={{
              fontSize: "14px",
              color: "#374151",
              fontStyle: "italic",
              margin: "12px 0 0 0",
              textAlign: "left",
            }}
          >
            &quot;{props.comment}&quot;
          </Text>
        )}
      </Section>

      <Section style={{ textAlign: "center", margin: "24px 0" }}>
        <EmailButton href={props.reviewsUrl}>View All Reviews</EmailButton>
      </Section>
    </BaseLayout>
  );
}
