"use client";

import { useTransition } from "react";
import { MessageSquare } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { getOrCreateConversation } from "@/actions/messages";
import { Button } from "@/components/ui/button";

interface MessageListerButtonProps {
  currentUserId: string;
  listingId: string;
  ownerId: string;
}

export function MessageListerButton({
  currentUserId,
  listingId,
  ownerId,
}: MessageListerButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      className="border-brand-navy text-brand-navy hover:bg-brand-light"
      disabled={isPending}
      onClick={() => {
        startTransition(async () => {
          try {
            const conversationId = await getOrCreateConversation(
              listingId,
              ownerId,
              currentUserId,
            );
            router.push(`/dashboard/messages/${conversationId}`);
          } catch (error) {
            toast.error(
              error instanceof Error ? error.message : "Could not open conversation",
            );
          }
        });
      }}
      size="sm"
      type="button"
      variant="outline"
    >
      <MessageSquare className="size-4" />
      {isPending ? "Opening..." : "Message Lister"}
    </Button>
  );
}
