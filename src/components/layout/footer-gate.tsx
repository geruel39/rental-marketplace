"use client";

import { usePathname } from "next/navigation";

import { Footer } from "@/components/layout/footer";

export function FooterGate() {
  const pathname = usePathname();

  if (
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/admin") ||
    pathname === "/maintenance"
  ) {
    return null;
  }

  return <Footer />;
}
