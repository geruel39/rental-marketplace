"use client";

import { useActionState, useEffect } from "react";
import { Loader2, Mail } from "lucide-react";
import { toast } from "sonner";

import { sendVerificationEmail } from "@/actions/profile";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

const initialState = null;

interface EmailVerificationCardProps {
  emailVerified: boolean;
}

export function EmailVerificationCard({
  emailVerified,
}: EmailVerificationCardProps) {
  const [state, formAction, isPending] = useActionState(
    sendVerificationEmail,
    initialState,
  );

  useEffect(() => {
    if (state?.success) {
      toast.success(state.success);
    }
  }, [state?.success]);

  useEffect(() => {
    if (state?.error) {
      toast.error(state.error);
    }
  }, [state?.error]);

  return (
    <div className="rounded-3xl border border-border bg-background p-6 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-1">
          <p className="flex items-center gap-2 font-medium">
            <Mail className="size-4" />
            Email
          </p>
          <p className="text-sm text-muted-foreground">
            {emailVerified ? "Verified" : "Not verified"}
          </p>
          {state?.success ? (
            <p className="text-sm text-emerald-600">
              {state.success}
            </p>
          ) : null}
        </div>
        {!emailVerified ? (
          <form action={formAction}>
            <Button disabled={isPending} type="submit" variant="outline">
              {isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Sending...
                </>
              ) : (
                "Send Verification Email"
              )}
            </Button>
          </form>
        ) : null}
      </div>
      {state?.error ? (
        <Alert className="mt-4" variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}
