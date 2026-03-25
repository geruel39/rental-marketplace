import { MessageSquareMore } from "lucide-react";
import { redirect } from "next/navigation";

import { getConversations } from "@/actions/messages";
import { ConversationList } from "@/components/messages/conversation-list";
import { EmptyState } from "@/components/shared/empty-state";
import { createClient } from "@/lib/supabase/server";

export default async function MessagesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const conversations = await getConversations(user.id);

  if (conversations.length === 0) {
    return (
      <EmptyState
        description="Start a conversation from a listing page and your inbox will appear here."
        icon={MessageSquareMore}
        title="No conversations yet"
      />
    );
  }

  return (
    <div className="grid gap-6 md:grid-cols-3">
      <div className="md:col-span-1">
        <ConversationList conversations={conversations} />
      </div>
      <div className="hidden min-h-[32rem] items-center justify-center rounded-3xl border border-dashed border-border bg-background px-6 text-center md:col-span-2 md:flex">
        <div className="space-y-3">
          <MessageSquareMore className="mx-auto size-10 text-muted-foreground" />
          <h1 className="text-xl font-semibold">Select a conversation</h1>
          <p className="max-w-md text-sm text-muted-foreground">
            Choose a thread on the left to view messages, load history, and reply in real time.
          </p>
        </div>
      </div>
    </div>
  );
}
