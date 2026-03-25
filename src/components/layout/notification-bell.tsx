"use client";

import Link from "next/link";
import { useEffect, useReducer } from "react";
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

type BellState = {
  notifications: Notification[];
  unreadCount: number;
};

type BellAction =
  | { type: "incoming"; notification: Notification }
  | { type: "read_one"; notificationId: string }
  | { type: "read_all" };

function bellReducer(state: BellState, action: BellAction): BellState {
  switch (action.type) {
    case "incoming":
      return {
        notifications: [
          action.notification,
          ...state.notifications.filter((item) => item.id !== action.notification.id),
        ].slice(0, 5),
        unreadCount: action.notification.is_read ? state.unreadCount : state.unreadCount + 1,
      };
    case "read_one": {
      const target = state.notifications.find(
        (notification) => notification.id === action.notificationId,
      );

      return {
        notifications: state.notifications.map((notification) =>
          notification.id === action.notificationId
            ? { ...notification, is_read: true }
            : notification,
        ),
        unreadCount:
          target && !target.is_read ? Math.max(0, state.unreadCount - 1) : state.unreadCount,
      };
    }
    case "read_all":
      return {
        notifications: state.notifications.map((notification) => ({
          ...notification,
          is_read: true,
        })),
        unreadCount: 0,
      };
    default:
      return state;
  }
}

export function NotificationBell({
  userId,
  initialNotifications,
  initialUnreadCount,
}: NotificationBellProps) {
  const { newNotification } = useRealtimeNotifications(userId);
  const [state, dispatch] = useReducer(bellReducer, {
    notifications: initialNotifications,
    unreadCount: initialUnreadCount,
  });

  useEffect(() => {
    if (!newNotification) {
      return;
    }

    dispatch({ type: "incoming", notification: newNotification });
  }, [newNotification]);

  function handleNotificationRead(notificationId: string) {
    dispatch({ type: "read_one", notificationId });
  }

  function handleAllRead() {
    dispatch({ type: "read_all" });
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button aria-label="Open notifications" className="relative" size="icon" variant="ghost">
          <Bell
            key={newNotification?.id ?? "bell"}
            className={cn(
              "size-5",
              newNotification ? "motion-safe:animate-[bell-shake_0.45s_ease-in-out]" : "",
            )}
          />
          {state.unreadCount > 0 ? (
            <span className="absolute right-1 top-1 flex min-w-5 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-semibold text-white">
              {state.unreadCount > 99 ? "99+" : state.unreadCount}
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
                {state.unreadCount > 0
                  ? `${state.unreadCount} unread`
                  : "No unread notifications"}
              </p>
            </div>
            <MarkAllReadButton onSuccess={handleAllRead} userId={userId} />
          </div>
        </div>

        <div className="max-h-[420px] overflow-y-auto p-3">
          <NotificationList
            compact
            notifications={state.notifications}
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
