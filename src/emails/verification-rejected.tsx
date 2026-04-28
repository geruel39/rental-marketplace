import { Section, Text } from "@react-email/components";
import {
  BaseLayout,
  EmailButton,
  EmailHeading,
  EmailInfoBox,
  EmailText,
} from "./base-layout";

interface VerificationRejectedEmailProps {
  displayName: string;
  reason: string;
  rejectedItems: string[];
  resubmitUrl: string;
}

export default function VerificationRejectedEmail(
  props: VerificationRejectedEmailProps,
) {
  return (
    <BaseLayout preview="Verification update — action required">
      <EmailHeading>⚠️ Verification Needs Attention</EmailHeading>
      <EmailText>Hi {props.displayName},</EmailText>
      <EmailText>
        Our team reviewed your verification documents and found some issues
        that need to be resolved before we can approve your account.
      </EmailText>

      <EmailInfoBox type="danger">
        <Text style={{ margin: "0 0 8px 0", fontWeight: "600", fontSize: "14px" }}>
          Items to resubmit:
        </Text>
        {props.rejectedItems.map((item, i) => (
          <Text key={i} style={{ margin: "2px 0", fontSize: "13px" }}>
            • {item}
          </Text>
        ))}
        {props.reason && (
          <Text
            style={{
              margin: "8px 0 0 0",
              fontSize: "13px",
              fontStyle: "italic",
            }}
          >
            Note: {props.reason}
          </Text>
        )}
      </EmailInfoBox>

      <EmailText>
        Please resubmit the required documents. Common reasons for rejection:
      </EmailText>
      <Section style={{ margin: "8px 0" }}>
        <Text style={{ fontSize: "15px", color: "#6b7280", lineHeight: "1.6", margin: "4px 0" }}>
          • Photo is blurry or too dark
        </Text>
        <Text style={{ fontSize: "15px", color: "#6b7280", lineHeight: "1.6", margin: "4px 0" }}>
          • All corners of the ID are not visible
        </Text>
        <Text style={{ fontSize: "15px", color: "#6b7280", lineHeight: "1.6", margin: "4px 0" }}>
          • Text in the document is not readable
        </Text>
        <Text style={{ fontSize: "15px", color: "#6b7280", lineHeight: "1.6", margin: "4px 0" }}>
          • Document appears edited or modified
        </Text>
      </Section>

      <Section style={{ textAlign: "center", margin: "24px 0" }}>
        <EmailButton href={props.resubmitUrl}>Resubmit Documents</EmailButton>
      </Section>
    </BaseLayout>
  );
}
