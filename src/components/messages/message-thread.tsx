"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { format } from "date-fns";

import { getMessages } from "@/actions/messages";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useRealtimeMessages } from "@/hooks/use-realtime";
import type { Message } from "@/types";

interface MessageThreadProps {
  conversationId: string;
  currentUserId: string;
  initialMessages: Message[];
}

export function MessageThread({
  conversationId,
  currentUserId,
  initialMessages,
}: MessageThreadProps) {
  const [loadedMessages, setLoadedMessages] = useState(initialMessages);
  const [optimisticMessages, setOptimisticMessages] = useState<Message[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(initialMessages.length === 20);
  const [isPending, startTransition] = useTransition();
  const { newMessages } = useRealtimeMessages(conversationId);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const messages = useMemo(() => {
    const seen = new Set<string>();
    const merged = [...loadedMessages, ...optimisticMessages, ...newMessages].filter((message) => {
      if (seen.has(message.id)) {
        return false;
      }

      seen.add(message.id);
      return true;
    });

    return merged.sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );
  }, [loadedMessages, newMessages, optimisticMessages]);
  const messageIds = useMemo(() => new Set(messages.map((message) => message.id)), [messages]);

  useEffect(() => {
    const handleMessageSent = (event: Event) => {
      const customEvent = event as CustomEvent<{
        conversationId: string;
        message: Message;
      }>;

      if (customEvent.detail.conversationId !== conversationId) {
        return;
      }

      setOptimisticMessages((current) => {
        if (current.some((message) => message.id === customEvent.detail.message.id)) {
          return current;
        }

        return [...current, customEvent.detail.message];
      });
    };

    window.addEventListener("message:sent", handleMessageSent as EventListener);

    return () => {
      window.removeEventListener("message:sent", handleMessageSent as EventListener);
    };
  }, [conversationId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    let cancelled = false;

    async function refreshLatestMessages() {
      if (document.visibilityState !== "visible") {
        return;
      }

      try {
        const result = await getMessages(conversationId, currentUserId, 1);

        if (cancelled) {
          return;
        }

        setLoadedMessages((current) => {
          const seen = new Set(current.map((message) => message.id));
          const incoming = result.messages.filter((message) => !seen.has(message.id));

          return incoming.length > 0 ? [...current, ...incoming] : current;
        });
      } catch {
        // Realtime is still the primary path. Polling is a quiet fallback.
      }
    }

    const intervalId = window.setInterval(() => {
      void refreshLatestMessages();
    }, 3000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [conversationId, currentUserId]);

  function loadOlderMessages() {
    if (!hasMore || isPending) {
      return;
    }

    startTransition(async () => {
      const nextPage = page + 1;
      const result = await getMessages(conversationId, currentUserId, nextPage);
      const uniqueMessages = result.messages.filter((message) => !messageIds.has(message.id));

      setLoadedMessages((current) => [...uniqueMessages, ...current]);
      setPage(nextPage);
      setHasMore(result.hasMore);
    });
  }

  return (
    <div className="flex min-h-[28rem] flex-1 flex-col overflow-hidden rounded-3xl border border-border bg-background md:min-h-0">
      <div className="border-b border-border px-4 py-3">
        {hasMore ? (
          <Button
            disabled={isPending}
            onClick={loadOlderMessages}
            size="sm"
            type="button"
            variant="outline"
          >
            {isPending ? <Loader2 className="size-4 animate-spin" /> : null}
            Load older messages
          </Button>
        ) : (
          <p className="text-sm text-muted-foreground">Start of conversation</p>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5">
        <div className="space-y-3">
          {messages.map((message) => {
            const isOwnMessage = message.sender_id === currentUserId;

            return (
              <div
                key={message.id}
                className={cn("flex", isOwnMessage ? "justify-end" : "justify-start")}
              >
                <div
                  className={cn(
                    "max-w-[80%] rounded-2xl px-4 py-3 text-sm shadow-sm",
                    isOwnMessage
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-foreground",
                  )}
                >
                  <p className="whitespace-pre-wrap break-words">{message.content}</p>
                  <p
                    className={cn(
                      "mt-2 text-xs",
                      isOwnMessage
                        ? "text-primary-foreground/80"
                        : "text-muted-foreground",
                    )}
                  >
                    {format(new Date(message.created_at), "p")}
                  </p>
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>
      </div>
    </div>
  );
}
