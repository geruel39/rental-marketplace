import {
  Compass,
  Heart,
  LayoutDashboard,
  Receipt,
  Settings,
  Star,
} from "lucide-react";
import { redirect } from "next/navigation";

import { RoleShell, type RoleShellItem } from "@/components/layout/role-shell";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/types";

export default async function RenterLayout({
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

  const [profileResult, activeCountResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle<Profile>(),
    supabase
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("renter_id", user.id)
      .in("status", ["lister_confirmation", "confirmed", "active"]),
  ]);

  if (!profileResult.data) {
    redirect("/login");
  }

  const activeCount = activeCountResult.count ?? 0;
  const primaryItems: RoleShellItem[] = [
    { href: "/renter/dashboard", label: "Overview", icon: LayoutDashboard },
    {
      href: "/renter/rentals",
      label: "My Rentals",
      icon: Receipt,
      badge: activeCount,
    },
    { href: "/renter/favorites", label: "Favorites", icon: Heart },
    { href: "/renter/reviews", label: "Reviews", icon: Star },
  ];
  const secondaryItems: RoleShellItem[] = [
    { href: "/renter/settings", label: "Settings", icon: Settings },
  ];

  return (
    <RoleShell
      avatarUrl={profileResult.data.avatar_url}
      bottomItems={[
        { href: "/renter/dashboard", label: "Overview", icon: LayoutDashboard },
        {
          href: "/renter/rentals",
          label: "Rentals",
          icon: Receipt,
          badge: activeCount,
        },
        { href: "/renter/favorites", label: "Favorites", icon: Heart },
        { href: "/listings", label: "Browse", icon: Compass },
      ]}
      browseHref="/listings"
      browseLabel="Browse Items"
      displayName={
        profileResult.data.display_name ||
        profileResult.data.full_name ||
        user.email ||
        "Renter"
      }
      modeLabel="Renter Mode"
      modeTone="bg-emerald-100 text-emerald-800"
      primaryItems={primaryItems}
      secondaryItems={secondaryItems}
      switchHref="/lister/dashboard"
      switchLabel="Switch to Lister View"
    >
      {children}
    </RoleShell>
  );
}
