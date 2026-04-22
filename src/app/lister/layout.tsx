import { redirect } from "next/navigation";

import { RoleShell, type RoleShellItem } from "@/components/layout/role-shell";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/types";

export default async function ListerLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [profileResult, pendingCountResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle<Profile>(),
    supabase
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("lister_id", user.id)
      .eq("status", "lister_confirmation"),
  ]);

  if (!profileResult.data) {
    redirect("/login");
  }

  const pendingCount = pendingCountResult.count ?? 0;
  const primaryItems: RoleShellItem[] = [
    { href: "/lister/dashboard", label: "Overview", icon: "layout-dashboard" },
    { href: "/lister/listings", label: "My Listings", icon: "package" },
    {
      href: "/lister/bookings",
      label: "Bookings",
      icon: "receipt",
      badge: pendingCount,
    },
    { href: "/lister/inventory", label: "Inventory", icon: "boxes" },
    { href: "/lister/earnings", label: "Earnings", icon: "badge-dollar-sign" },
    { href: "/lister/reviews", label: "Reviews", icon: "star" },
  ];
  const secondaryItems: RoleShellItem[] = [
    { href: "/lister/settings", label: "Settings", icon: "settings" },
  ];

  return (
    <RoleShell
      avatarUrl={profileResult.data.avatar_url}
      bottomItems={[
        { href: "/lister/dashboard", label: "Overview", icon: "layout-dashboard" },
        { href: "/lister/listings", label: "Listings", icon: "package" },
        {
          href: "/lister/bookings",
          label: "Bookings",
          icon: "receipt",
          badge: pendingCount,
        },
        { href: "/lister/earnings", label: "Earnings", icon: "badge-dollar-sign" },
      ]}
      browseHref="/listings"
      browseLabel="Browse Items"
      displayName={
        profileResult.data.display_name ||
        profileResult.data.full_name ||
        user.email ||
        "Lister"
      }
      modeLabel="Lister Mode"
      modeTone="bg-brand-navy/10 text-brand-navy"
      primaryItems={primaryItems}
      secondaryItems={secondaryItems}
      switchHref="/renter/dashboard"
      switchLabel="Switch to Renter View"
    >
      {children}
    </RoleShell>
  );
}
