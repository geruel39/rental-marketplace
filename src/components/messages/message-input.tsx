"use client";

import { useState, useTransition } from "react";
import { SendHorizonal } from "lucide-react";
import { toast } from "sonner";

import { sendMessage } from "@/actions/messages";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface MessageInputProps {
  conversationId: string;
  recipientId: string;
}

export function MessageInput({
  conversationId,
  recipientId,
}: MessageInputProps) {
  const [content, setContent] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleSubmit() {
    const trimmed = content.trim();

    if (!trimmed) {
      return;
    }

    const formData = new FormData();
    formData.set("conversation_id", conversationId);
    formData.set("recipient_id", recipientId);
    formData.set("content", trimmed);

    startTransition(async () => {
      const result = await sendMessage(formData);

      if (result.error) {
        toast.error(result.error);
        return;
      }

      if (result.message) {
        window.dispatchEvent(
          new CustomEvent("message:sent", {
            detail: {
              conversationId,
              message: result.message,
            },
          }),
        );
      }

      setContent("");
    });
  }

  return (
    <div className="rounded-3xl border border-border bg-background p-4">
      <Textarea
        className="min-h-24 resize-none"
        disabled={isPending}
        onChange={(event) => setContent(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            handleSubmit();
          }
        }}
        placeholder="Write a message..."
        value={content}
      />
      <div className="mt-3 flex items-center justify-end">
        <Button disabled={isPending || content.trim().length === 0} onClick={handleSubmit} type="button">
          <SendHorizonal className="size-4" />
          {isPending ? "Sending..." : "Send"}
        </Button>
      </div>
    </div>
  );
}
