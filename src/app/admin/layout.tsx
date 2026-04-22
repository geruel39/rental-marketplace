import Link from "next/link";
import { redirect } from "next/navigation";

import { getPendingKYCVerifications } from "@/actions/admin";
import { getVerificationQueue } from "@/actions/verification";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { getInitials } from "@/lib/utils";
import type { Profile } from "@/types";

export default async function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/dashboard");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, avatar_url, display_name, full_name, email, is_admin")
    .eq("id", user.id)
    .maybeSingle<
      Pick<Profile, "id" | "avatar_url" | "display_name" | "full_name" | "email" | "is_admin">
    >();

  if (!profile?.is_admin) {
    redirect("/dashboard");
  }

  const displayName =
    profile.display_name || profile.full_name || profile.email || user.email || "Admin";
  const [{ count: pendingVerificationCount }, { count: pendingKycCount }, failedPayoutsResult] = await Promise.all([
    getVerificationQueue(),
    getPendingKYCVerifications(),
    supabase
      .from("payouts")
      .select("id", { count: "exact", head: true })
      .eq("status", "failed"),
  ]);

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-brand-light">
      <AdminSidebar
        failedPayoutCount={failedPayoutsResult.count ?? 0}
        pendingVerificationCount={pendingVerificationCount}
        pendingKycCount={pendingKycCount}
      />
      <div className="lg:pl-72">
        <div className="border-b border-brand-navy/10 bg-brand-navy text-white">
          <div className="flex min-h-16 items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
            <div className="flex items-center gap-3">
              <Badge className="bg-brand-sky text-brand-dark hover:bg-brand-sky">
                ADMIN
              </Badge>
              <div>
                <p className="text-sm font-semibold text-white">Admin Panel</p>
                <p className="text-xs text-white/75">
                  Platform controls and moderation tools
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-3 rounded-full border border-white/10 bg-white/10 px-2 py-1.5 sm:px-3">
                <Avatar size="sm">
                  {profile.avatar_url ? (
                    <AvatarImage alt={displayName} src={profile.avatar_url} />
                  ) : null}
                  <AvatarFallback>{getInitials(displayName)}</AvatarFallback>
                </Avatar>
                <span className="hidden text-sm font-medium text-white sm:inline">
                  {displayName}
                </span>
              </div>

              <Button asChild className="bg-white text-brand-navy hover:bg-brand-light">
                <Link href="/dashboard">Exit Admin</Link>
              </Button>
            </div>
          </div>
        </div>

        <main className="min-h-[calc(100vh-8rem)] px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
