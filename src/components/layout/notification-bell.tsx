"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Bell } from "lucide-react";

import { NotificationList } from "@/components/notifications/notification-list";
import { MarkAllReadButton } from "@/components/notifications/mark-all-read-button";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useRealtimeNotifications } from "@/hooks/use-realtime";
import { cn } from "@/lib/utils";
import type { Notification } from "@/types";

interface NotificationBellProps {
  userId: string;
  initialNotifications: Notification[];
  initialUnreadCount: number;
}

export function NotificationBell({
  userId,
  initialNotifications,
  initialUnreadCount,
}: NotificationBellProps) {
  const { latestNotification, unreadCount: realtimeUnreadCount } =
    useRealtimeNotifications(userId, initialUnreadCount);
  const [notifications, setNotifications] = useState(initialNotifications);
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount);

  useEffect(() => {
    setNotifications(initialNotifications);
  }, [initialNotifications]);

  useEffect(() => {
    setUnreadCount(initialUnreadCount);
  }, [initialUnreadCount]);

  useEffect(() => {
    setUnreadCount(realtimeUnreadCount);
  }, [realtimeUnreadCount]);

  useEffect(() => {
    if (!latestNotification) {
      return;
    }

    setNotifications((current) =>
      [latestNotification, ...current.filter((item) => item.id !== latestNotification.id)].slice(
        0,
        5,
      ),
    );
  }, [latestNotification]);

  function handleNotificationRead(notificationId: string) {
    setNotifications((current) =>
      current.map((notification) =>
        notification.id === notificationId ? { ...notification, is_read: true } : notification,
      ),
    );
    setUnreadCount((current) => Math.max(0, current - 1));
  }

  function handleAllRead() {
    setNotifications((current) =>
      current.map((notification) => ({ ...notification, is_read: true })),
    );
    setUnreadCount(0);
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button aria-label="Open notifications" className="relative" size="icon" variant="ghost">
          <Bell
            key={latestNotification?.id ?? "bell"}
            className={cn(
              "size-5",
              latestNotification ? "motion-safe:animate-[bell-shake_0.45s_ease-in-out]" : "",
            )}
          />
          {unreadCount > 0 ? (
            <span className="absolute right-1 top-1 flex min-w-5 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-semibold text-white">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          ) : null}
          <span className="sr-only">Notifications</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[360px] p-0">
        <div className="border-b border-border px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-semibold">Notifications</p>
              <p className="text-xs text-muted-foreground">
                {unreadCount > 0
                  ? `${unreadCount} unread`
                  : "No unread notifications"}
              </p>
            </div>
            <MarkAllReadButton onSuccess={handleAllRead} userId={userId} />
          </div>
        </div>

        <div className="max-h-[420px] overflow-y-auto p-3">
          <NotificationList
            compact
            notifications={notifications}
            onNotificationRead={handleNotificationRead}
          />
        </div>

        <div className="border-t border-border px-4 py-3 text-right">
          <Link
            className="text-sm font-medium text-primary hover:underline"
            href="/dashboard/notifications"
          >
            View All
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
