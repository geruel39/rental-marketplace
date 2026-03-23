"use client";

import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";

interface AuthSubmitButtonProps {
  children: React.ReactNode;
  pendingLabel: string;
}

export function AuthSubmitButton({
  children,
  pendingLabel,
}: AuthSubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <Button className="w-full" type="submit" disabled={pending}>
      {pending ? pendingLabel : children}
    </Button>
  );
}
