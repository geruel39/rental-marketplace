import type { ReactNode } from "react";
import {
  Body,
  Container,
  Font,
  Head,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";

interface BaseLayoutProps {
  preview: string;
  children: ReactNode;
}

interface EmailButtonProps {
  href: string;
  children: ReactNode;
  variant?: "primary" | "secondary" | "danger";
}

interface EmailInfoBoxProps {
  children: ReactNode;
  type?: "info" | "warning" | "success" | "danger";
}

interface EmailHeadingProps {
  children: ReactNode;
}

interface EmailTextProps {
  children: ReactNode;
  muted?: boolean;
}

interface EmailBookingSummaryProps {
  booking: {
    listingTitle: string;
    rentalUnits: number;
    pricingPeriod: string;
    quantity: number;
    totalPrice: number;
    currency?: string;
  };
}

export function BaseLayout({ preview, children }: BaseLayoutProps) {
  return (
    <Html>
      <Head>
        <Font
          fontFamily="Inter"
          fallbackFontFamily="Arial"
          webFont={{
            url: "https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hiJ-Ek-_EeA.woff2",
            format: "woff2",
          }}
          fontWeight={400}
          fontStyle="normal"
        />
      </Head>
      <Preview>{preview}</Preview>
      <Body
        style={{
          backgroundColor: "#f2f2f2",
          fontFamily: "Inter, Arial, sans-serif",
          margin: 0,
          padding: 0,
        }}
      >
        <Container
          style={{
            maxWidth: "600px",
            margin: "0 auto",
            padding: "20px 0",
          }}
        >
          <Section
            style={{
              backgroundColor: "#003e86",
              borderRadius: "8px 8px 0 0",
              padding: "24px 32px",
            }}
          >
            <Text
              style={{
                color: "#ffffff",
                fontSize: "24px",
                fontWeight: "700",
                margin: 0,
              }}
            >
              RentHub
            </Text>
            <Text
              style={{
                color: "#38bdf2",
                fontSize: "12px",
                margin: "4px 0 0 0",
              }}
            >
              The P2P Rental Marketplace
            </Text>
          </Section>

          <Section
            style={{
              backgroundColor: "#ffffff",
              padding: "32px",
              borderRadius: "0 0 8px 8px",
            }}
          >
            {children}
          </Section>

          <Section style={{ padding: "20px 32px" }}>
            <Hr style={{ borderColor: "#e0e0e0", margin: "0 0 16px 0" }} />
            <Text
              style={{
                color: "#9ca3af",
                fontSize: "12px",
                textAlign: "center",
                margin: 0,
              }}
            >
              © {new Date().getFullYear()} RentHub. All rights reserved.
            </Text>
            <Text
              style={{
                color: "#9ca3af",
                fontSize: "12px",
                textAlign: "center",
                margin: "4px 0 0 0",
              }}
            >
              <Link
                href={`${process.env.NEXT_PUBLIC_APP_URL}/policies`}
                style={{ color: "#9ca3af" }}
              >
                Policies
              </Link>
              {" · "}
              <Link
                href={`${process.env.NEXT_PUBLIC_APP_URL}/help`}
                style={{ color: "#9ca3af" }}
              >
                Help Center
              </Link>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

export function EmailButton({
  href,
  children,
  variant = "primary",
}: EmailButtonProps) {
  const colors = {
    primary: { bg: "#003e86", text: "#ffffff" },
    secondary: { bg: "#f2f2f2", text: "#003e86" },
    danger: { bg: "#dc2626", text: "#ffffff" },
  } as const;
  const c = colors[variant];

  return (
    <Link
      href={href}
      style={{
        display: "inline-block",
        backgroundColor: c.bg,
        color: c.text,
        padding: "12px 24px",
        borderRadius: "6px",
        fontWeight: "600",
        fontSize: "14px",
        textDecoration: "none",
        textAlign: "center",
        margin: "8px 0",
      }}
    >
      {children}
    </Link>
  );
}

export function EmailInfoBox({
  children,
  type = "info",
}: EmailInfoBoxProps) {
  const styles = {
    info: { bg: "#eff6ff", border: "#003e86", text: "#1e3a5f" },
    warning: { bg: "#fffbeb", border: "#f59e0b", text: "#92400e" },
    success: { bg: "#f0fdf4", border: "#16a34a", text: "#14532d" },
    danger: { bg: "#fef2f2", border: "#dc2626", text: "#991b1b" },
  } as const;
  const s = styles[type];

  return (
    <Section
      style={{
        backgroundColor: s.bg,
        borderLeft: `4px solid ${s.border}`,
        borderRadius: "0 6px 6px 0",
        padding: "12px 16px",
        margin: "16px 0",
        color: s.text,
        fontSize: "14px",
      }}
    >
      {children}
    </Section>
  );
}

export function EmailDivider() {
  return <Hr style={{ borderColor: "#e5e7eb", margin: "24px 0" }} />;
}

export function EmailHeading({ children }: EmailHeadingProps) {
  return (
    <Text
      style={{
        fontSize: "22px",
        fontWeight: "700",
        color: "#2e2e2f",
        margin: "0 0 8px 0",
      }}
    >
      {children}
    </Text>
  );
}

export function EmailText({ children, muted = false }: EmailTextProps) {
  return (
    <Text
      style={{
        fontSize: "15px",
        color: muted ? "#6b7280" : "#374151",
        lineHeight: "1.6",
        margin: "8px 0",
      }}
    >
      {children}
    </Text>
  );
}

export function EmailBookingSummary({
  booking,
}: EmailBookingSummaryProps) {
  const currency = booking.currency ?? "SGD";

  return (
    <Section
      style={{
        backgroundColor: "#f9fafb",
        borderRadius: "8px",
        padding: "16px 20px",
        margin: "16px 0",
      }}
    >
      <Text
        style={{
          fontWeight: "600",
          fontSize: "14px",
          color: "#2e2e2f",
          margin: "0 0 8px 0",
        }}
      >
        Booking Summary
      </Text>
      <Text style={{ fontSize: "14px", color: "#374151", margin: "4px 0" }}>
        📦 {booking.listingTitle}
      </Text>
      <Text style={{ fontSize: "14px", color: "#374151", margin: "4px 0" }}>
        ⏱ {booking.rentalUnits} {booking.pricingPeriod}(s)
        {booking.quantity > 1 ? ` × ${booking.quantity} items` : ""}
      </Text>
      <Text
        style={{
          fontSize: "16px",
          fontWeight: "700",
          color: "#003e86",
          margin: "8px 0 0 0",
        }}
      >
        Total: {currency} ${booking.totalPrice.toFixed(2)}
      </Text>
    </Section>
  );
}
