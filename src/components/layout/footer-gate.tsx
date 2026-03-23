"use client";

import { usePathname } from "next/navigation";

import { Footer } from "@/components/layout/footer";

export function FooterGate() {
  const pathname = usePathname();

  if (pathname.startsWith("/dashboard")) {
    return null;
  }

  return <Footer />;
}
