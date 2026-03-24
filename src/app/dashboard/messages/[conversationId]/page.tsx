import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound, redirect } from "next/navigation";

import { getConversations, getMessages } from "@/actions/messages";
import { ConversationList } from "@/components/messages/conversation-list";
import { MessageInput } from "@/components/messages/message-input";
import { MessageThread } from "@/components/messages/message-thread";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { getInitials } from "@/lib/utils";

export default async function ConversationPage({
  params,
}: {
  params: Promise<{ conversationId: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { conversationId } = await params;
  const conversations = await getConversations(user.id);

  const activeConversation = conversations.find(
    (conversation) => conversation.id === conversationId,
  );

  if (!activeConversation) {
    notFound();
  }

  const initialMessagePage = await getMessages(conversationId, user.id);

  const displayName =
    activeConversation.other_user.display_name ||
    activeConversation.other_user.full_name;

  return (
    <div className="grid gap-6 md:grid-cols-3">
      <div className="hidden md:col-span-1 md:block">
        <ConversationList
          activeConversationId={conversationId}
          conversations={conversations}
        />
      </div>

      <div className="space-y-4 md:col-span-2">
        <Button asChild className="md:hidden" size="sm" variant="ghost">
          <Link href="/dashboard/messages">
            <ArrowLeft className="size-4" />
            Back to Messages
          </Link>
        </Button>

        <div className="flex items-start gap-3 rounded-3xl border border-border bg-background p-4">
          <Avatar size="lg">
            <AvatarImage
              alt={displayName}
              src={activeConversation.other_user.avatar_url ?? undefined}
            />
            <AvatarFallback>{getInitials(displayName)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 space-y-1">
            <h1 className="truncate text-lg font-semibold">{displayName}</h1>
            {activeConversation.listing ? (
              <Link
                className="truncate text-sm text-muted-foreground underline-offset-4 hover:underline"
                href={`/listings/${activeConversation.listing.id}`}
              >
                Re: {activeConversation.listing.title}
              </Link>
            ) : (
              <p className="text-sm text-muted-foreground">Direct conversation</p>
            )}
          </div>
        </div>

        <MessageThread
          conversationId={conversationId}
          currentUserId={user.id}
          initialMessages={initialMessagePage.messages}
          key={`thread-${conversationId}`}
        />
        <MessageInput
          conversationId={conversationId}
          key={`input-${conversationId}`}
          recipientId={activeConversation.other_user.id}
        />
      </div>
    </div>
  );
}
