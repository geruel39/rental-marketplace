"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { markAsRead } from "@/actions/notifications";
import { HydratedRelativeTime } from "@/components/shared/hydrated-relative-time";
import {
  formatBundlePreviewItem,
  getNotificationMeta,
  getNotificationPriority,
  getNotificationTarget,
  getNotificationTimestamp,
} from "@/lib/notification-meta";
import { cn } from "@/lib/utils";
import { NOTIFICATION_CONFIG } from "@/types";
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
    const targetUrl = getNotificationTarget(notification);

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

    if (targetUrl) {
      router.push(targetUrl);
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
        const priority = getNotificationPriority(notification.type);
        const targetLabel = notification.is_bundled
          ? notification.type === "new_message"
            ? "View All Messages →"
            : `View All ${NOTIFICATION_CONFIG[notification.type].label} →`
          : "Open notification →";
        const remainingPreviewCount = Math.max(
          notification.bundle_count - notification.bundle_preview.length,
          0,
        );

        return (
          <button
            key={notification.id}
            className={cn(
              "w-full rounded-2xl border border-border text-left transition-colors hover:bg-muted/30",
              compact ? "p-3" : "p-4",
              notification.is_read
                ? "bg-brand-light/60"
                : "bg-white",
              !notification.is_read && priority === "urgent"
                ? "border-l-4 border-l-red-500"
                : "",
              !notification.is_read && priority === "high"
                ? "border-l-4 border-l-orange-400"
                : "",
              !notification.is_read && priority === "medium"
                ? "border-l-4 border-l-brand-sky"
                : "",
              !notification.is_read && priority === "low" && !compact
                ? "border-l-4 border-l-brand-sky"
                : "",
              compact && priority === "urgent" ? "border-l-2 border-l-red-500" : "",
              compact && priority === "high" ? "border-l-2 border-l-orange-400" : "",
              compact && priority === "medium" ? "border-l-2 border-l-brand-sky" : "",
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
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start gap-2">
                      <p
                        className={cn(
                          "line-clamp-1 text-sm",
                          notification.is_read ? "font-medium" : "font-semibold",
                        )}
                      >
                        {notification.is_bundled
                          ? `You have ${notification.bundle_count} new messages`
                          : notification.title}
                      </p>
                      {notification.is_bundled ? (
                        <span className={cn(
                          "inline-flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-white",
                          compact ? "bg-brand-sky" : "bg-brand-navy",
                        )}>
                          {notification.bundle_count}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <HydratedRelativeTime
                    className="shrink-0 text-xs text-muted-foreground"
                    value={getNotificationTimestamp(notification)}
                  />
                </div>
                {notification.is_bundled ? (
                  compact ? (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {notification.bundle_preview.slice(0, 2).map((item, index) => (
                        <span
                          className="inline-flex max-w-full rounded-full bg-brand-light px-2 py-1 text-[11px] text-muted-foreground"
                          key={`${notification.id}-${index}`}
                        >
                          <span className="truncate">
                            {formatBundlePreviewItem(item, {
                              maxTextLength: 40,
                            })}
                          </span>
                        </span>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-2 space-y-1.5 text-sm text-muted-foreground">
                      {notification.bundle_preview.slice(0, 3).map((item, index) => (
                        <p key={`${notification.id}-${index}`} className="pl-3">
                          {index === notification.bundle_preview.length - 1 &&
                          remainingPreviewCount === 0
                            ? "└ "
                            : "├ "}
                          {formatBundlePreviewItem(item, {
                            maxTextLength: 72,
                            quoted: true,
                          })}
                        </p>
                      ))}
                      {remainingPreviewCount > 0 ? (
                        <p className="pl-3">└ +{remainingPreviewCount} more</p>
                      ) : null}
                    </div>
                  )
                ) : notification.body ? (
                  <p
                    className={cn(
                      "mt-1 text-sm text-muted-foreground",
                      compact ? "line-clamp-2" : "line-clamp-2",
                    )}
                  >
                    {notification.body}
                  </p>
                ) : null}
                {!compact ? (
                  <p className="mt-3 text-sm font-medium text-brand-navy">
                    {targetLabel}
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
