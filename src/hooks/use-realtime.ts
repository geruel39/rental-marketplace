"use client";

import { useEffect, useState } from "react";

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

export function useRealtimeNotifications(userId: string) {
  const [newNotification, setNewNotification] = useState<Notification | null>(null);
  const [newNotifications, setNewNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

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
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const notification = payload.new as Notification;
          setNewNotification(notification);
          setNewNotifications((current) => [...current, notification]);
          setUnreadCount((current) => current + 1);
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId]);

  return { newNotification, newNotifications, unreadCount };
}
