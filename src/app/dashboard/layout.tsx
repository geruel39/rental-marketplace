import { redirect } from "next/navigation";

import { DashboardSidebar } from "@/components/layout/dashboard-sidebar";
import { MobileNav } from "@/components/layout/mobile-nav";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardLayout({
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

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin, payout_setup_completed, total_listings")
    .eq("id", user.id)
    .maybeSingle<{
      is_admin: boolean;
      payout_setup_completed: boolean;
      total_listings: number;
    }>();

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-brand-light">
      <DashboardSidebar
        currentUserId={user.id}
        hasListerActivity={(profile?.total_listings ?? 0) > 0}
        isAdmin={profile?.is_admin ?? false}
        payoutSetupCompleted={profile?.payout_setup_completed ?? true}
      />
      <div className="lg:pl-64">
        <main className="min-h-[calc(100vh-4rem)] overflow-y-auto px-4 py-6 pb-24 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
      <MobileNav />
    </div>
  );
}
