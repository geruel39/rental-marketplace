import Link from "next/link";
import { redirect } from "next/navigation";

import { getNotifications } from "@/actions/notifications";
import { MarkAllReadButton } from "@/components/notifications/mark-all-read-button";
import { NotificationList } from "@/components/notifications/notification-list";
import { Pagination } from "@/components/shared/pagination";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { createClient } from "@/lib/supabase/server";

interface NotificationsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function getSingleValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function parsePage(value: string | undefined) {
  const page = Number(value ?? "1");
  return Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
}

export default async function NotificationsPage({
  searchParams,
}: NotificationsPageProps) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const resolvedSearchParams = await searchParams;
  const unreadOnly = getSingleValue(resolvedSearchParams.filter) === "unread";
  const page = parsePage(getSingleValue(resolvedSearchParams.page));
  const notifications = await getNotifications(user.id, page, unreadOnly);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">Notifications</h1>
          <p className="text-sm text-muted-foreground">
            Stay on top of bookings, messages, reviews, and payment updates.
          </p>
        </div>
        <MarkAllReadButton userId={user.id} variant="outline" />
      </div>

      <Tabs value={unreadOnly ? "unread" : "all"}>
        <TabsList variant="line">
          <TabsTrigger asChild value="all">
            <Link href="/dashboard/notifications">All</Link>
          </TabsTrigger>
          <TabsTrigger asChild value="unread">
            <Link href="/dashboard/notifications?filter=unread">Unread</Link>
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <NotificationList notifications={notifications.data} />

      <Pagination currentPage={notifications.currentPage} totalPages={notifications.totalPages} />
    </div>
  );
}
