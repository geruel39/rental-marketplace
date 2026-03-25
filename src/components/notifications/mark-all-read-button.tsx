"use client";

import { useTransition } from "react";
import { CheckCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { markAllAsRead } from "@/actions/notifications";
import { Button } from "@/components/ui/button";

interface MarkAllReadButtonProps {
  userId: string;
  onSuccess?: () => void;
  variant?: "default" | "ghost" | "outline" | "secondary";
  className?: string;
}

export function MarkAllReadButton({
  userId,
  onSuccess,
  variant = "ghost",
  className,
}: MarkAllReadButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      const result = await markAllAsRead(userId);

      if (result.error) {
        toast.error(result.error);
        return;
      }

      onSuccess?.();
      router.refresh();

      if (result.success) {
        toast.success(result.success);
      }
    });
  }

  return (
    <Button
      className={className}
      disabled={isPending}
      onClick={handleClick}
      size="sm"
      type="button"
      variant={variant}
    >
      <CheckCheck className="size-4" />
      {isPending ? "Marking..." : "Mark All as Read"}
    </Button>
  );
}
