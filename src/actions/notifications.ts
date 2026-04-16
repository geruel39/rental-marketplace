"use server";

import { revalidatePath } from "next/cache";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { ActionResponse, Notification, PaginatedResponse } from "@/types";

const NOTIFICATIONS_PER_PAGE = 15;

function getPagination(page?: number, perPage = NOTIFICATIONS_PER_PAGE) {
  const currentPage = Math.max(1, page ?? 1);
  const from = (currentPage - 1) * perPage;
  const to = from + perPage - 1;

  return { currentPage, from, to, perPage };
}

async function requireCurrentUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("You must be signed in");
  }

  return { supabase, user };
}

export async function getNotifications(
  userId: string,
  page?: number,
  unreadOnly?: boolean,
): Promise<PaginatedResponse<Notification>> {
  const supabase = await createClient();
  const { currentPage, from, to, perPage } = getPagination(page);

  let query = supabase
    .from("notifications")
    .select("*", { count: "exact" })
    .eq("user_id", userId)
    .order("is_read", { ascending: true })
    .order("created_at", { ascending: false });

  if (unreadOnly) {
    query = query.eq("is_read", false);
  }

  const { data, error, count } = await query.range(from, to);

  try {
    if (error) {
      throw error;
    }

    return {
      data: (data ?? []) as Notification[],
      totalCount: count ?? 0,
      totalPages: Math.max(1, Math.ceil((count ?? 0) / perPage)),
      currentPage,
    };
  } catch (caughtError) {
    console.error("getNotifications failed:", caughtError);
    return {
      data: [],
      totalCount: 0,
      totalPages: 0,
      currentPage,
    };
  }
}

export async function getUnreadCount(userId: string): Promise<number> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("get_notification_bell_count", {
      p_user_id: userId,
    });

    if (error) {
      throw error;
    }

    return typeof data === "number" ? data : 0;
  } catch (error) {
    console.error("getUnreadCount failed:", error);
    return 0;
  }
}

export async function markAsRead(notificationId: string): Promise<ActionResponse> {
  try {
    const { supabase, user } = await requireCurrentUser();
    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("id", notificationId)
      .eq("user_id", user.id);

    if (error) {
      console.error("markAsRead update failed:", error);
      return { error: "Could not update that notification. Please try again." };
    }

    revalidatePath("/dashboard/notifications");
    return { success: "Notification marked as read" };
  } catch (error) {
    console.error("markAsRead failed:", error);
    return { error: "Something went wrong. Please try again." };
  }
}

export async function markAllAsRead(userId: string): Promise<ActionResponse> {
  try {
    const { supabase, user } = await requireCurrentUser();

    if (user.id !== userId) {
      return { error: "You cannot update another user's notifications" };
    }

    const { error } = await supabase.rpc("mark_all_notifications_read", {
      p_user_id: userId,
    });

    if (error) {
      console.error("markAllAsRead update failed:", error);
      return { error: "Could not update notifications. Please try again." };
    }

    revalidatePath("/dashboard/notifications");
    return { success: "All notifications marked as read" };
  } catch (error) {
    console.error("markAllAsRead failed:", error);
    return { error: "Something went wrong. Please try again." };
  }
}

export async function createNotification(params: {
  userId: string;
  type: string;
  title: string;
  body?: string;
  listingId?: string;
  bookingId?: string;
  fromUserId?: string;
  actionUrl?: string;
}): Promise<void> {
  try {
    const admin = createAdminClient();
    const { error } = await admin.from("notifications").insert({
      user_id: params.userId,
      type: params.type,
      title: params.title,
      body: params.body ?? null,
      listing_id: params.listingId ?? null,
      booking_id: params.bookingId ?? null,
      from_user_id: params.fromUserId ?? null,
      action_url: params.actionUrl ?? null,
    });

    if (error) {
      throw error;
    }
  } catch (error) {
    console.error("createNotification failed:", error);
  }
}
