"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { markAsRead } from "@/actions/notifications";
import { HydratedRelativeTime } from "@/components/shared/hydrated-relative-time";
import { getNotificationMeta } from "@/lib/notification-meta";
import { cn } from "@/lib/utils";
import type { Notification } from "@/types";

interface NotificationListProps {
  notifications: Notification[];
  compact?: boolean;
  emptyMessage?: string;
  onNotificationRead?: (notificationId: string) => void;
}

export function NotificationList({
  notifications,
  compact = false,
  emptyMessage = "You're all caught up! 🎉",
  onNotificationRead,
}: NotificationListProps) {
  const router = useRouter();
  const [pendingNotificationId, setPendingNotificationId] = useState<string | null>(null);

  async function handleClick(notification: Notification) {
    setPendingNotificationId(notification.id);

    if (!notification.is_read) {
      const result = await markAsRead(notification.id);

      if (result.error) {
        setPendingNotificationId(null);
        toast.error(result.error);
        return;
      }

      onNotificationRead?.(notification.id);
    }

    setPendingNotificationId(null);

    if (notification.action_url) {
      router.push(notification.action_url);
      router.refresh();
    }
  }

  if (notifications.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {notifications.map((notification) => {
        const meta = getNotificationMeta(notification.type);
        const Icon = meta.icon;

        return (
          <button
            key={notification.id}
            className={cn(
              "w-full rounded-2xl border border-border bg-background text-left transition-colors hover:bg-muted/40",
              compact ? "p-3" : "p-4",
              !compact && !notification.is_read ? "border-l-4 border-l-primary" : "",
              pendingNotificationId === notification.id ? "opacity-70" : "",
            )}
            disabled={pendingNotificationId === notification.id}
            onClick={() => void handleClick(notification)}
            type="button"
          >
            <div className="flex items-start gap-3">
              <div
                className={cn(
                  "flex shrink-0 items-center justify-center rounded-full",
                  compact ? "size-9" : "size-10",
                  meta.iconContainerClassName,
                )}
              >
                <Icon className={cn("size-4", meta.iconClassName)} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <p
                    className={cn(
                      "line-clamp-1 text-sm",
                      notification.is_read ? "font-medium" : "font-semibold",
                    )}
                  >
                    {notification.title}
                  </p>
                  <HydratedRelativeTime
                    className="shrink-0 text-xs text-muted-foreground"
                    value={notification.created_at}
                  />
                </div>
                {notification.body ? (
                  <p
                    className={cn(
                      "mt-1 text-sm text-muted-foreground",
                      compact ? "line-clamp-2" : "",
                    )}
                  >
                    {notification.body}
                  </p>
                ) : null}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
