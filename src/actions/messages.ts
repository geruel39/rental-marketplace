"use server";

import { notifyNewMessage } from "@/lib/notifications";
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

async function findExistingConversation(
  supabase: SupabaseClient,
  currentUserId: string,
  otherUserId: string,
) {
  const { data, error } = await supabase
    .from("conversations")
    .select("*")
    .or(
      `and(participant_1.eq.${currentUserId},participant_2.eq.${otherUserId}),and(participant_1.eq.${otherUserId},participant_2.eq.${currentUserId})`,
    )
    .order("last_message_at", { ascending: false })
    .limit(1);

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? [])[0] as Conversation | undefined) ?? null;
}

async function getRelatedConversations(
  supabase: SupabaseClient,
  currentUserId: string,
  otherUserId: string,
) {
  const { data, error } = await supabase
    .from("conversations")
    .select("*")
    .or(
      `and(participant_1.eq.${currentUserId},participant_2.eq.${otherUserId}),and(participant_1.eq.${otherUserId},participant_2.eq.${currentUserId})`,
    )
    .order("last_message_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as Conversation[];
}

export async function getConversations(
  userId: string,
): Promise<ConversationWithDetails[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("conversations")
      .select("*")
      .or(`participant_1.eq.${userId},participant_2.eq.${userId}`)
      .order("last_message_at", { ascending: false });

    if (error) {
      throw error;
    }

    const allConversations = (data ?? []) as Conversation[];
    const conversations = Array.from(
      allConversations
        .reduce((map, conversation) => {
          const otherUserId =
            conversation.participant_1 === userId
              ? conversation.participant_2
              : conversation.participant_1;
          const existingConversation = map.get(otherUserId);

          if (!existingConversation) {
            map.set(otherUserId, conversation);
            return map;
          }

          const existingDate = new Date(existingConversation.last_message_at).getTime();
          const nextDate = new Date(conversation.last_message_at).getTime();

          if (nextDate >= existingDate) {
            map.set(otherUserId, {
              ...conversation,
              unread_count_1:
                conversation.unread_count_1 + existingConversation.unread_count_1,
              unread_count_2:
                conversation.unread_count_2 + existingConversation.unread_count_2,
            });
          } else {
            map.set(otherUserId, {
              ...existingConversation,
              unread_count_1:
                conversation.unread_count_1 + existingConversation.unread_count_1,
              unread_count_2:
                conversation.unread_count_2 + existingConversation.unread_count_2,
            });
          }

          return map;
        }, new Map<string, Conversation>())
        .values(),
    );
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
  } catch (error) {
    console.error("getConversations failed:", error);
    return [];
  }
}

export async function getMessages(
  conversationId: string,
  userId: string,
  page?: number,
): Promise<{ messages: Message[]; hasMore: boolean }> {
  try {
    const supabase = await createClient();
    const conversation = await getConversationForUser(supabase, conversationId, userId);

    if (!conversation) {
      return { messages: [], hasMore: false };
    }

    const currentPage = getPage(page);
    const from = (currentPage - 1) * MESSAGES_PER_PAGE;
    const to = from + MESSAGES_PER_PAGE - 1;
    const { otherUserId, isParticipantOne } = getConversationParticipants(
      conversation,
      userId,
    );
    const relatedConversations = await getRelatedConversations(
      supabase,
      userId,
      otherUserId,
    );
    const conversationIds = relatedConversations.map((item) => item.id);

    const [{ data, error, count }, unreadUpdate] = await Promise.all([
      supabase
        .from("messages")
        .select("*", { count: "exact" })
        .in("conversation_id", conversationIds)
        .order("created_at", { ascending: false })
        .range(from, to),
      supabase
        .from("messages")
        .update({ is_read: true })
        .in("conversation_id", conversationIds)
        .eq("sender_id", otherUserId)
        .eq("is_read", false),
    ]);

    if (error) {
      throw error;
    }

    if (unreadUpdate.error) {
      throw unreadUpdate.error;
    }

    const unreadField = isParticipantOne ? "unread_count_1" : "unread_count_2";
    const { error: conversationUpdateError } = await supabase
      .from("conversations")
      .update({ [unreadField]: 0 })
      .in("id", conversationIds);

    if (conversationUpdateError) {
      throw conversationUpdateError;
    }

    const messages = ((data ?? []) as Message[]).reverse();

    return {
      messages,
      hasMore: (count ?? 0) > to + 1,
    };
  } catch (error) {
    console.error("getMessages failed:", error);
    return { messages: [], hasMore: false };
  }
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
      const requestedConversation = await getConversationForUser(
        supabase,
        parsed.data.conversation_id,
        user.id,
      );

      if (!requestedConversation) {
        return { error: "Conversation not found" };
      }

      recipientId =
        requestedConversation.participant_1 === user.id
          ? requestedConversation.participant_2
          : requestedConversation.participant_1;
      conversation = await findExistingConversation(supabase, user.id, recipientId);
    } else {
      if (parsed.data.recipient_id === user.id) {
        return { error: "You cannot message yourself" };
      }

      conversation = await findExistingConversation(
        supabase,
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

    void notifyNewMessage({
      recipientId,
      senderName,
      messagePreview: parsed.data.content,
      conversationId: conversation.id,
    }).catch((error) => {
      console.error("sendMessage notification failed:", error);
    });

    return {
      success: "Message sent",
      conversationId: conversation.id,
      message,
    };
  } catch (error) {
    console.error("sendMessage failed:", error);
    return { error: "Something went wrong. Please try again." };
  }
}

export async function getOrCreateConversation(
  listingId: string,
  otherUserId: string,
  currentUserId: string,
): Promise<string> {
  try {
    const supabase = await createClient();
    const existingConversation = await findExistingConversation(
      supabase,
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
      throw error ?? new Error("Missing conversation");
    }

    return data.id;
  } catch (error) {
    console.error("getOrCreateConversation failed:", error);
    throw new Error("Could not open this conversation. Please try again.");
  }
}

export async function getOrCreateDirectConversation(
  otherUserId: string,
  currentUserId: string,
): Promise<string> {
  try {
    const supabase = await createClient();
    const existingConversation = await findExistingConversation(
      supabase,
      currentUserId,
      otherUserId,
    );

    if (existingConversation) {
      return existingConversation.id;
    }

    const { data, error } = await supabase
      .from("conversations")
      .insert({
        listing_id: null,
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
      throw error ?? new Error("Missing conversation");
    }

    return data.id;
  } catch (error) {
    console.error("getOrCreateDirectConversation failed:", error);
    throw new Error("Could not open this conversation. Please try again.");
  }
}
