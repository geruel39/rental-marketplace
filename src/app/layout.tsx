import type { Metadata } from "next";

import { FooterGate } from "@/components/layout/footer-gate";
import { Navbar } from "@/components/layout/navbar";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: "RentHub - P2P Rental Marketplace",
  description:
    "RentHub is a peer-to-peer rental marketplace for listing, booking, inventory, payments, and trust.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body className={`font-sans min-h-full bg-background text-foreground`}>
        <div className="flex min-h-screen flex-col">
          <Navbar />
          <div className="flex-1">{children}</div>
          <FooterGate />
        </div>
        <Toaster />
      </body>
    </html>
  );
}
