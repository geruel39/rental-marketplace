import { AlertTriangle } from "lucide-react";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { PlatformSettingsForm } from "@/components/admin/platform-settings-form";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { JsonValue, Profile } from "@/types";

async function verifyAdminAccess() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("Unauthorized");
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle<{ is_admin: boolean }>();
  if (!profile?.is_admin) throw new Error("Unauthorized");
}

export default async function AdminSettingsPage() {
  await verifyAdminAccess();
  const admin = createAdminClient();

  const [settingsResult, settingAuditResult] = await Promise.all([
    admin.from("platform_settings").select("key, value"),
    admin
      .from("admin_audit_log")
      .select(
        `
          target_id,
          created_at,
          admin:profiles!admin_audit_log_admin_id_fkey(display_name, full_name, email)
        `,
      )
      .eq("target_type", "settings")
      .eq("action", "update_platform_setting")
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  const initialSettings = (settingsResult.data ?? []).reduce<Record<string, JsonValue>>((acc, row) => {
    acc[row.key] = row.value as JsonValue;
    return acc;
  }, {});

  const metadata = ((settingAuditResult.data ?? []) as Array<{
    target_id: string;
    created_at: string;
    admin: Array<Pick<Profile, "display_name" | "full_name" | "email">> | null;
  }>).reduce<Record<string, { updatedBy: string; updatedAt: string }>>((acc, entry) => {
    if (acc[entry.target_id]) return acc;
    const adminProfile = entry.admin?.[0];
    const adminName = adminProfile?.display_name || adminProfile?.full_name || adminProfile?.email || "Admin";
    acc[entry.target_id] = {
      updatedBy: adminName,
      updatedAt: entry.created_at,
    };
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Platform Settings"
        description="Adjust platform-wide fees, listing rules, and operational switches."
      />

      <Alert className="border-brand-navy/20 bg-brand-light text-brand-dark">
        <AlertTriangle className="text-brand-navy" />
        <AlertTitle>Changes take effect immediately</AlertTitle>
        <AlertDescription>
          Review each update carefully before saving, especially maintenance mode and fee changes.
        </AlertDescription>
      </Alert>

      <PlatformSettingsForm initialSettings={initialSettings} metadata={metadata} />
    </div>
  );
}

