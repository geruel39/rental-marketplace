"use client";

import { startTransition, useActionState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { updatePayoutSettings } from "@/actions/profile";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ActionResponse, Profile } from "@/types";

interface PayoutSettingsFormProps {
  profile: Profile;
}

const initialState: ActionResponse | null = null;

export function PayoutSettingsForm({ profile }: PayoutSettingsFormProps) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(
    updatePayoutSettings,
    initialState,
  );

  useEffect(() => {
    if (!state?.success) {
      return;
    }

    toast.success(state.success);
    router.refresh();
  }, [router, state?.success]);

  useEffect(() => {
    if (!state?.error) {
      return;
    }

    toast.error(state.error);
  }, [state?.error]);

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        startTransition(() => {
          formAction(formData);
        });
      }}
    >
      {state?.error ? (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="payout_email">Payout Email</Label>
        <Input
          defaultValue={profile.payout_email ?? ""}
          id="payout_email"
          name="payout_email"
          type="email"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="bank_name">Bank Name</Label>
          <Input
            defaultValue={profile.payout_bank_account?.bank_name ?? ""}
            id="bank_name"
            name="bank_name"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="account_holder">Account Holder</Label>
          <Input
            defaultValue={profile.payout_bank_account?.account_holder ?? ""}
            id="account_holder"
            name="account_holder"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="account_number">Account Number</Label>
          <Input
            defaultValue={profile.payout_bank_account?.account_number ?? ""}
            id="account_number"
            name="account_number"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="routing_number">Routing Number</Label>
          <Input
            defaultValue={profile.payout_bank_account?.routing_number ?? ""}
            id="routing_number"
            name="routing_number"
          />
        </div>
      </div>

      <Button disabled={isPending} type="submit">
        {isPending ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            Saving...
          </>
        ) : (
          "Save Payout Settings"
        )}
      </Button>
    </form>
  );
}
