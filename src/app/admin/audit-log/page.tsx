import Link from "next/link";

import { getAuditLog } from "@/actions/admin";
import { AdminAuditTable } from "@/components/admin/admin-audit-table";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { Pagination } from "@/components/shared/pagination";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { AdminTargetType, Profile } from "@/types";

type SearchParams = Record<string, string | string[] | undefined>;

function getSingleValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

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

const targetTypes: Array<AdminTargetType | "all"> = [
  "all",
  "user",
  "listing",
  "booking",
  "review",
  "payout",
  "category",
  "report",
  "settings",
];

export default async function AdminAuditLogPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await verifyAdminAccess();
  const resolvedSearchParams = await searchParams;
  const adminId = getSingleValue(resolvedSearchParams.adminId) ?? "all";
  const targetType = (getSingleValue(resolvedSearchParams.targetType) ?? "all") as AdminTargetType | "all";
  const dateFrom = getSingleValue(resolvedSearchParams.dateFrom) ?? "";
  const dateTo = getSingleValue(resolvedSearchParams.dateTo) ?? "";
  const page = Number(getSingleValue(resolvedSearchParams.page) ?? "1");

  const admin = createAdminClient();
  const adminUsersResult = await admin
    .from("profiles")
    .select("id, display_name, full_name, email")
    .eq("is_admin", true)
    .order("display_name", { ascending: true });

  const auditResult = await getAuditLog({
    adminId: adminId === "all" ? undefined : adminId,
    targetType,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    page,
    perPage: 20,
  });

  const adminUsers = (adminUsersResult.data ?? []) as Array<
    Pick<Profile, "id" | "display_name" | "full_name" | "email">
  >;

  return (
    <div className="space-y-6">
      <AdminPageHeader
        action={(
          <Button className="bg-brand-navy text-white hover:bg-brand-steel" type="button" variant="default">
            Export
          </Button>
        )}
        title="Audit Log"
        description="Inspect administrative actions across moderation, payouts, settings, and operational decisions."
      />

      <form className="grid gap-4 rounded-3xl border border-border/70 bg-white p-5 shadow-sm md:grid-cols-4">
        <div className="space-y-2">
          <Label htmlFor="adminId">Admin user</Label>
          <Select defaultValue={adminId} name="adminId">
            <SelectTrigger id="adminId">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All admins</SelectItem>
              {adminUsers.map((item) => (
                <SelectItem key={item.id} value={item.id}>
                  {item.display_name || item.full_name || item.email}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="targetType">Target type</Label>
          <Select defaultValue={targetType} name="targetType">
            <SelectTrigger id="targetType">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {targetTypes.map((item) => (
                <SelectItem key={item} value={item}>
                  {item === "all" ? "All target types" : item}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="dateFrom">Date from</Label>
          <Input defaultValue={dateFrom} id="dateFrom" name="dateFrom" type="date" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="dateTo">Date to</Label>
          <Input defaultValue={dateTo} id="dateTo" name="dateTo" type="date" />
        </div>

        <input name="page" type="hidden" value="1" />

        <div className="md:col-span-4 flex flex-wrap items-center gap-3">
          <Button className="bg-brand-navy text-white hover:bg-brand-steel" type="submit">
            Apply Filters
          </Button>
          <Button asChild type="button" variant="outline">
            <Link href="/admin/audit-log">Reset</Link>
          </Button>
        </div>
      </form>

      <AdminAuditTable entries={auditResult.data} />

      <div className="flex justify-end">
        <Pagination currentPage={auditResult.currentPage} totalPages={auditResult.totalPages} />
      </div>
    </div>
  );
}


