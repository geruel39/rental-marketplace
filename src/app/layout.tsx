import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "P2P Rental Marketplace",
  description: "Peer-to-peer rental marketplace",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full bg-background font-sans text-foreground">
        {children}
      </body>
    </html>
  );
}
