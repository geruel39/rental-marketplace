"use client";

import { useEffect, useState, useTransition } from "react";

import { getUnreadCount } from "@/actions/notifications";
import { createClient } from "@/lib/supabase/client";
import type { Message, Notification } from "@/types";

export function useRealtimeMessages(conversationId: string) {
  const [newMessages, setNewMessages] = useState<Message[]>([]);

  useEffect(() => {
    if (!conversationId) {
      return;
    }

    const supabase = createClient();

    const channel = supabase
      .channel(`messages:${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          setNewMessages((current) => [...current, payload.new as Message]);
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [conversationId]);

  return { newMessages };
}

export function useRealtimeNotifications(userId: string, initialUnreadCount = 0) {
  const [latestNotification, setLatestNotification] = useState<Notification | null>(null);
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount);
  const [, startTransition] = useTransition();

  function refresh() {
    if (!userId) {
      setUnreadCount(0);
      return;
    }

    startTransition(async () => {
      const nextCount = await getUnreadCount(userId);
      setUnreadCount(nextCount);
    });
  }

  useEffect(() => {
    if (!userId) {
      return;
    }

    const supabase = createClient();

    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          if (!payload.new) {
            return;
          }

          const notification = payload.new as Notification;
          setLatestNotification(notification);

          if (payload.eventType === "INSERT") {
            if (!notification.is_read) {
              setUnreadCount((current) => current + 1);
            }

            refresh();
            return;
          }

          if (payload.eventType === "UPDATE" && notification.is_bundled) {
            refresh();
            return;
          }

          refresh();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId]);

  useEffect(() => {
    setUnreadCount(initialUnreadCount);
  }, [initialUnreadCount]);

  return { unreadCount, latestNotification, refresh };
}
