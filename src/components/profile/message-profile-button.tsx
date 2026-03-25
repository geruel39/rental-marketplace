"use client";

import { useTransition } from "react";
import { MessageSquare } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { getOrCreateDirectConversation } from "@/actions/messages";
import { Button } from "@/components/ui/button";

interface MessageProfileButtonProps {
  currentUserId: string;
  profileUserId: string;
}

export function MessageProfileButton({
  currentUserId,
  profileUserId,
}: MessageProfileButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      disabled={isPending}
      onClick={() => {
        startTransition(async () => {
          try {
            const conversationId = await getOrCreateDirectConversation(
              profileUserId,
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
      type="button"
    >
      <MessageSquare className="size-4" />
      {isPending ? "Opening..." : "Message"}
    </Button>
  );
}
