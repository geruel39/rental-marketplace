"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { SendHorizonal } from "lucide-react";
import { toast } from "sonner";

import { sendMessage } from "@/actions/messages";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";

interface MessageInputProps {
  className?: string;
  conversationId: string;
  recipientId: string;
}

export function MessageInput({
  className,
  conversationId,
  recipientId,
}: MessageInputProps) {
  const [content, setContent] = useState("");
  const [isPending, startTransition] = useTransition();
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const textarea = textareaRef.current;

    if (!textarea) {
      return;
    }

    textarea.style.height = "0px";

    const computedStyle = window.getComputedStyle(textarea);
    const lineHeight = Number.parseFloat(computedStyle.lineHeight) || 24;
    const borderHeight =
      Number.parseFloat(computedStyle.borderTopWidth) +
      Number.parseFloat(computedStyle.borderBottomWidth);
    const verticalPadding =
      Number.parseFloat(computedStyle.paddingTop) +
      Number.parseFloat(computedStyle.paddingBottom);
    const maxHeight = lineHeight * 3 + verticalPadding + borderHeight;

    textarea.style.height = `${Math.min(textarea.scrollHeight, maxHeight)}px`;
    textarea.style.overflowY = textarea.scrollHeight > maxHeight ? "auto" : "hidden";
  }, [content]);

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
    <div className={cn("rounded-3xl border border-border bg-background p-4", className)}>
      <div className="flex items-end gap-3">
      <Textarea
        ref={textareaRef}
        className="min-h-0 flex-1 resize-none rounded-2xl bg-muted/40 px-4 py-3"
        disabled={isPending}
        onChange={(event) => setContent(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            handleSubmit();
          }
        }}
        placeholder="Write a message..."
        rows={1}
        value={content}
      />
        <Button
          className="shrink-0 rounded-full px-4"
          disabled={isPending || content.trim().length === 0}
          onClick={handleSubmit}
          type="button"
        >
          <SendHorizonal className="size-4" />
          {isPending ? "Sending..." : "Send"}
        </Button>
      </div>
    </div>
  );
}
