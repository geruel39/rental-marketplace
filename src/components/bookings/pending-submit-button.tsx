"use client";

import { Loader2 } from "lucide-react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";

interface PendingSubmitButtonProps {
  children: React.ReactNode;
  className?: string;
  pendingLabel?: string;
  size?: "default" | "sm" | "lg" | "icon" | "xs" | "icon-xs" | "icon-sm" | "icon-lg";
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
}

export function PendingSubmitButton({
  children,
  className,
  pendingLabel,
  size = "default",
  variant = "default",
}: PendingSubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <Button
      className={className}
      disabled={pending}
      size={size}
      type="submit"
      variant={variant}
    >
      <Loader2
        className={pending ? "size-4 animate-spin" : "size-4 opacity-0"}
      />
      <span>{pending && pendingLabel ? pendingLabel : children}</span>
    </Button>
  );
}
