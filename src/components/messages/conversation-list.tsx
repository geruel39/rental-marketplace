"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { MessageSquareMore, Search } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { HydratedRelativeTime } from "@/components/shared/hydrated-relative-time";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn, getInitials } from "@/lib/utils";
import type { ConversationWithDetails } from "@/types";

interface ConversationListProps {
  conversations: ConversationWithDetails[];
  activeConversationId?: string;
  basePath?: string;
}

export function ConversationList({
  conversations,
  activeConversationId,
  basePath = "/dashboard/messages",
}: ConversationListProps) {
  const [search, setSearch] = useState("");

  const filteredConversations = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return conversations;
    }

    return conversations.filter((conversation) => {
      const name = (
        conversation.other_user.display_name || conversation.other_user.full_name
      ).toLowerCase();
      const listingTitle = conversation.listing?.title?.toLowerCase() ?? "";

      return name.includes(query) || listingTitle.includes(query);
    });
  }, [conversations, search]);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-3xl border border-border bg-background">
      <div className="shrink-0 border-b border-border px-4 pt-4 pb-3">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">Messages</h2>
            <p className="text-xs text-muted-foreground">
              {filteredConversations.length} conversation{filteredConversations.length === 1 ? "" : "s"}
            </p>
          </div>
        </div>
        <div className="relative">
          <Search className="absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="h-10 rounded-full bg-muted/35 pl-9"
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search conversations"
            value={search}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-2">
        {filteredConversations.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-4 py-10 text-center">
            <MessageSquareMore className="size-8 text-muted-foreground" />
            <p className="font-medium">No matching conversations</p>
            <p className="text-sm text-muted-foreground">
              Try another name or listing title.
            </p>
          </div>
        ) : (
          filteredConversations.map((conversation) => {
            const displayName =
              conversation.other_user.display_name || conversation.other_user.full_name;
            const isActive = conversation.id === activeConversationId;

            return (
              <Link
                key={conversation.id}
                className={cn(
                  "flex items-start gap-3 rounded-2xl px-3 py-2.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  isActive ? "bg-primary/8 shadow-sm" : "hover:bg-muted/50",
                )}
                href={`${basePath}/${conversation.id}`}
              >
                <Avatar>
                  <AvatarImage
                    alt={displayName}
                    src={conversation.other_user.avatar_url ?? undefined}
                  />
                  <AvatarFallback>{getInitials(displayName)}</AvatarFallback>
                </Avatar>

                <div className="min-w-0 flex-1 space-y-0.5">
                  <div className="flex items-start justify-between gap-3">
                    <p className="truncate text-sm font-semibold">{displayName}</p>
                    <HydratedRelativeTime
                      className="shrink-0 text-xs text-muted-foreground"
                      value={conversation.last_message_at}
                    />
                  </div>

                  {conversation.listing ? (
                    <p className="truncate text-[11px] text-muted-foreground">
                      {conversation.listing.title}
                    </p>
                  ) : null}

                  <div className="flex items-center justify-between gap-3">
                    <p className="truncate text-xs text-muted-foreground">
                      {conversation.last_message_preview || "No messages yet"}
                    </p>
                    {conversation.unread_count > 0 ? (
                      <Badge className="h-5 shrink-0 rounded-full px-1.5 text-[11px]" variant="default">
                        {conversation.unread_count}
                      </Badge>
                    ) : null}
                  </div>
                </div>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}
