"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { messageSchema } from "@/lib/validations";
import type {
  ActionResponse,
  Conversation,
  ConversationWithDetails,
  Listing,
  Message,
  Profile,
} from "@/types";

const MESSAGES_PER_PAGE = 20;

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function getPage(page?: number) {
  return Math.max(1, page ?? 1);
}

function getConversationParticipants(
  conversation: Pick<Conversation, "participant_1" | "participant_2">,
  userId: string,
) {
  const isParticipantOne = conversation.participant_1 === userId;

  return {
    isParticipantOne,
    otherUserId: isParticipantOne
      ? conversation.participant_2
      : conversation.participant_1,
  };
}

async function getCurrentUserContext() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("You must be signed in to use messaging");
  }

  return { supabase, user };
}

async function getProfileMap(
  supabase: SupabaseClient,
  userIds: string[],
) {
  if (userIds.length === 0) {
    return new Map<string, Profile>();
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .in("id", userIds);

  if (error) {
    throw new Error(error.message);
  }

  return new Map((data ?? []).map((profile) => [profile.id, profile as Profile]));
}

async function getListingMap(
  supabase: SupabaseClient,
  listingIds: string[],
) {
  if (listingIds.length === 0) {
    return new Map<string, Listing>();
  }

  const { data, error } = await supabase
    .from("listings")
    .select("*")
    .in("id", listingIds);

  if (error) {
    throw new Error(error.message);
  }

  return new Map((data ?? []).map((listing) => [listing.id, listing as Listing]));
}

async function getConversationForUser(
  supabase: SupabaseClient,
  conversationId: string,
  userId: string,
) {
  const { data, error } = await supabase
    .from("conversations")
    .select("*")
    .eq("id", conversationId)
    .or(`participant_1.eq.${userId},participant_2.eq.${userId}`)
    .maybeSingle<Conversation>();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

async function createMessageNotification(
  {
    userId,
    senderName,
    conversationId,
    listingId,
  }: {
    userId: string;
    senderName: string;
    conversationId: string;
    listingId?: string | null;
  },
) {
  const admin = createAdminClient();
  const { error } = await admin.from("notifications").insert({
    user_id: userId,
    type: "new_message",
    title: `New message from ${senderName}`,
    listing_id: listingId ?? null,
    action_url: `/dashboard/messages/${conversationId}`,
  });

  if (error) {
    throw new Error(error.message);
  }
}

async function findExistingConversation(
  supabase: SupabaseClient,
  listingId: string,
  currentUserId: string,
  otherUserId: string,
) {
  const { data, error } = await supabase
    .from("conversations")
    .select("*")
    .eq("listing_id", listingId)
    .or(
      `and(participant_1.eq.${currentUserId},participant_2.eq.${otherUserId}),and(participant_1.eq.${otherUserId},participant_2.eq.${currentUserId})`,
    )
    .maybeSingle<Conversation>();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function getConversations(
  userId: string,
): Promise<ConversationWithDetails[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("conversations")
    .select("*")
    .or(`participant_1.eq.${userId},participant_2.eq.${userId}`)
    .order("last_message_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  const conversations = (data ?? []) as Conversation[];
  const otherUserIds = Array.from(
    new Set(
      conversations.map((conversation) =>
        conversation.participant_1 === userId
          ? conversation.participant_2
          : conversation.participant_1,
      ),
    ),
  );
  const listingIds = Array.from(
    new Set(
      conversations
        .map((conversation) => conversation.listing_id)
        .filter((listingId): listingId is string => Boolean(listingId)),
    ),
  );

  const [profileMap, listingMap] = await Promise.all([
    getProfileMap(supabase, otherUserIds),
    getListingMap(supabase, listingIds),
  ]);

  return conversations.reduce<ConversationWithDetails[]>((acc, conversation) => {
      const { otherUserId } = getConversationParticipants(conversation, userId);
      const otherUser = profileMap.get(otherUserId);

      if (!otherUser) {
        return acc;
      }

      acc.push({
        ...conversation,
        other_user: otherUser,
        ...(conversation.listing_id
          ? { listing: listingMap.get(conversation.listing_id) }
          : {}),
        unread_count:
          conversation.participant_1 === userId
            ? conversation.unread_count_1
            : conversation.unread_count_2,
      });

      return acc;
    }, []);
}

export async function getMessages(
  conversationId: string,
  userId: string,
  page?: number,
): Promise<{ messages: Message[]; hasMore: boolean }> {
  const supabase = await createClient();
  const conversation = await getConversationForUser(supabase, conversationId, userId);

  if (!conversation) {
    throw new Error("Conversation not found");
  }

  const currentPage = getPage(page);
  const from = (currentPage - 1) * MESSAGES_PER_PAGE;
  const to = from + MESSAGES_PER_PAGE - 1;
  const { otherUserId, isParticipantOne } = getConversationParticipants(
    conversation,
    userId,
  );

  const [{ data, error, count }, unreadUpdate] = await Promise.all([
    supabase
      .from("messages")
      .select("*", { count: "exact" })
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: false })
      .range(from, to),
    supabase
      .from("messages")
      .update({ is_read: true })
      .eq("conversation_id", conversationId)
      .eq("sender_id", otherUserId)
      .eq("is_read", false),
  ]);

  if (error) {
    throw new Error(error.message);
  }

  if (unreadUpdate.error) {
    throw new Error(unreadUpdate.error.message);
  }

  const unreadField = isParticipantOne ? "unread_count_1" : "unread_count_2";
  const { error: conversationUpdateError } = await supabase
    .from("conversations")
    .update({ [unreadField]: 0 })
    .eq("id", conversationId);

  if (conversationUpdateError) {
    throw new Error(conversationUpdateError.message);
  }

  const messages = ((data ?? []) as Message[]).reverse();

  return {
    messages,
    hasMore: (count ?? 0) > to + 1,
  };
}

export async function sendMessage(
  formData: FormData,
): Promise<ActionResponse & { conversationId?: string; message?: Message }> {
  try {
    const { supabase, user } = await getCurrentUserContext();
    const parsed = messageSchema.safeParse({
      conversation_id: formData.get("conversation_id") || undefined,
      listing_id: formData.get("listing_id") || undefined,
      recipient_id: formData.get("recipient_id") || undefined,
      content: formData.get("content")?.toString().trim(),
    });

    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Invalid message" };
    }

    if (!parsed.data.conversation_id && (!parsed.data.listing_id || !parsed.data.recipient_id)) {
      return {
        error: "A listing and recipient are required to start a conversation",
      };
    }

    let conversation: Conversation | null = null;
    let recipientId = parsed.data.recipient_id ?? null;

    if (parsed.data.conversation_id) {
      conversation = await getConversationForUser(
        supabase,
        parsed.data.conversation_id,
        user.id,
      );

      if (!conversation) {
        return { error: "Conversation not found" };
      }

      recipientId =
        conversation.participant_1 === user.id
          ? conversation.participant_2
          : conversation.participant_1;
    } else {
      if (parsed.data.recipient_id === user.id) {
        return { error: "You cannot message yourself" };
      }

      conversation = await findExistingConversation(
        supabase,
        parsed.data.listing_id!,
        user.id,
        parsed.data.recipient_id!,
      );

      if (!conversation) {
        const { data: createdConversation, error: conversationError } = await supabase
          .from("conversations")
          .insert({
            listing_id: parsed.data.listing_id,
            participant_1: user.id,
            participant_2: parsed.data.recipient_id,
            last_message_at: new Date().toISOString(),
            last_message_preview: "",
            unread_count_1: 0,
            unread_count_2: 0,
          })
          .select("*")
          .single<Conversation>();

        if (conversationError) {
          return { error: conversationError.message };
        }

        conversation = createdConversation;
      }
    }

    if (!conversation || !recipientId) {
      return { error: "Could not prepare this conversation" };
    }

    const { data: message, error: messageError } = await supabase
      .from("messages")
      .insert({
        conversation_id: conversation.id,
        sender_id: user.id,
        content: parsed.data.content,
        message_type: "text",
      })
      .select("*")
      .single<Message>();

    if (messageError || !message) {
      return { error: messageError?.message ?? "Failed to send message" };
    }

    const unreadField =
      conversation.participant_1 === recipientId ? "unread_count_1" : "unread_count_2";
    const nextUnreadCount =
      conversation.participant_1 === recipientId
        ? conversation.unread_count_1 + 1
        : conversation.unread_count_2 + 1;

    const { error: conversationUpdateError } = await supabase
      .from("conversations")
      .update({
        last_message_at: message.created_at,
        last_message_preview: parsed.data.content.slice(0, 100),
        [unreadField]: nextUnreadCount,
      })
      .eq("id", conversation.id);

    if (conversationUpdateError) {
      return { error: conversationUpdateError.message };
    }

    const { data: senderProfile, error: profileError } = await supabase
      .from("profiles")
      .select("display_name, full_name")
      .eq("id", user.id)
      .maybeSingle<{ display_name: string; full_name: string }>();

    if (profileError) {
      return { error: profileError.message };
    }

    const senderName =
      senderProfile?.display_name || senderProfile?.full_name || "Someone";

    await createMessageNotification({
      userId: recipientId,
      senderName,
      conversationId: conversation.id,
      listingId: conversation.listing_id,
    });

    return {
      success: "Message sent",
      conversationId: conversation.id,
      message,
    };
  } catch (error) {
    return { error: getErrorMessage(error, "Failed to send message") };
  }
}

export async function getOrCreateConversation(
  listingId: string,
  otherUserId: string,
  currentUserId: string,
): Promise<string> {
  const supabase = await createClient();
  const existingConversation = await findExistingConversation(
    supabase,
    listingId,
    currentUserId,
    otherUserId,
  );

  if (existingConversation) {
    return existingConversation.id;
  }

  const { data, error } = await supabase
    .from("conversations")
    .insert({
      listing_id: listingId,
      participant_1: currentUserId,
      participant_2: otherUserId,
      last_message_at: new Date().toISOString(),
      last_message_preview: "",
      unread_count_1: 0,
      unread_count_2: 0,
    })
    .select("id")
    .single<{ id: string }>();

  if (error || !data) {
    throw new Error(error?.message ?? "Could not create conversation");
  }

  return data.id;
}
