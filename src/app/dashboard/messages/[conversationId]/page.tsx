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
    <div className="grid gap-6 md:h-[calc(100dvh-11.5rem)] md:min-h-0 md:grid-cols-3">
      <div className="hidden min-h-0 md:col-span-1 md:block">
        <ConversationList
          activeConversationId={conversationId}
          conversations={conversations}
        />
      </div>

      <div className="flex min-h-0 flex-col gap-4 md:col-span-2 md:overflow-hidden">
        <Button asChild className="md:hidden" size="sm" variant="ghost">
          <Link href="/dashboard/messages">
            <ArrowLeft className="size-4" />
            Back to Messages
          </Link>
        </Button>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-3xl border border-border bg-background">
          <div className="flex shrink-0 items-start gap-3 border-b border-border px-4 py-4">
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
            className="min-h-0 flex-1 rounded-none border-0 bg-transparent"
            conversationId={conversationId}
            currentUserId={user.id}
            initialMessages={initialMessagePage.messages}
            key={`thread-${conversationId}`}
          />
          <MessageInput
            className="shrink-0 rounded-none border-0 border-t border-border bg-transparent px-4 py-3"
            conversationId={conversationId}
            key={`input-${conversationId}`}
            recipientId={activeConversation.other_user.id}
          />
        </div>
      </div>
    </div>
  );
}
