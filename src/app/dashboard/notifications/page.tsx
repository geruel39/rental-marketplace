import Link from "next/link";
import { redirect } from "next/navigation";

import { getNotifications, getUnreadCount } from "@/actions/notifications";
import { MarkAllReadButton } from "@/components/notifications/mark-all-read-button";
import { NotificationList } from "@/components/notifications/notification-list";
import { Pagination } from "@/components/shared/pagination";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getNotificationPriority } from "@/lib/notification-meta";
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
  const activeFilter = getSingleValue(resolvedSearchParams.filter) ?? "all";
  const unreadOnly = activeFilter === "unread";
  const page = parsePage(getSingleValue(resolvedSearchParams.page));
  const [notifications, unreadCount] = await Promise.all([
    getNotifications(user.id, page, unreadOnly),
    getUnreadCount(user.id),
  ]);
  const urgentNotifications = notifications.data.filter(
    (notification) => getNotificationPriority(notification.type) === "urgent",
  );
  const updateNotifications = notifications.data.filter(
    (notification) => getNotificationPriority(notification.type) !== "urgent",
  );
  const visibleNotifications = notifications.data;
  const emptyMessage =
    activeFilter === "unread"
      ? "No unread notifications"
      : activeFilter === "urgent"
        ? "No urgent notifications"
        : "You're all caught up! 🎉";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">Notifications</h1>
          <p className="text-sm text-muted-foreground">{unreadCount} unread</p>
        </div>
        <MarkAllReadButton userId={user.id} variant="outline" />
      </div>

      <Tabs value={activeFilter}>
        <TabsList variant="line">
          <TabsTrigger asChild value="all">
            <Link href="/dashboard/notifications">All</Link>
          </TabsTrigger>
          <TabsTrigger asChild value="unread">
            <Link href="/dashboard/notifications?filter=unread">Unread</Link>
          </TabsTrigger>
          <TabsTrigger asChild value="urgent">
            <Link href="/dashboard/notifications?filter=urgent">Urgent</Link>
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {activeFilter === "urgent" ? (
        <div className="space-y-6">
          {urgentNotifications.length > 0 ? (
            <section className="space-y-3">
              <div className="border-b border-red-200 pb-2">
                <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-red-600">
                  Requires Action
                </h2>
              </div>
              <NotificationList
                emptyMessage={emptyMessage}
                notifications={urgentNotifications}
              />
            </section>
          ) : null}

          {updateNotifications.length > 0 ? (
            <section className="space-y-3">
              <div className="border-b border-brand-sky/30 pb-2">
                <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-brand-navy">
                  Updates
                </h2>
              </div>
              <NotificationList notifications={updateNotifications} />
            </section>
          ) : null}

          {urgentNotifications.length === 0 && updateNotifications.length === 0 ? (
            <NotificationList emptyMessage={emptyMessage} notifications={[]} />
          ) : null}
        </div>
      ) : (
        <NotificationList emptyMessage={emptyMessage} notifications={visibleNotifications} />
      )}

      <Pagination currentPage={notifications.currentPage} totalPages={notifications.totalPages} />
    </div>
  );
}
