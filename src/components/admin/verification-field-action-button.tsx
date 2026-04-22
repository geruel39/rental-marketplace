"use client";

import { useTransition } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import {
  verifyBusinessDocument,
  verifyIndividualDocument,
} from "@/actions/verification";
import { Button } from "@/components/ui/button";
import type { AccountType } from "@/types";

type IndividualField = "gov_id" | "selfie";
type BusinessField =
  | "business_document"
  | "rep_gov_id"
  | "rep_selfie"
  | "business_address"
  | "tin";

interface VerificationFieldActionButtonProps {
  userId: string;
  accountType: AccountType;
  field: IndividualField | BusinessField;
  approved: boolean;
}

export function VerificationFieldActionButton({
  userId,
  accountType,
  field,
  approved,
}: VerificationFieldActionButtonProps) {
  const [isPending, startTransition] = useTransition();

  function submit() {
    startTransition(async () => {
      const result =
        accountType === "individual"
          ? await verifyIndividualDocument({
              userId,
              field: field as IndividualField,
              approved,
              notes: approved ? undefined : "Rejected during admin review.",
            })
          : await verifyBusinessDocument({
              userId,
              field: field as BusinessField,
              approved,
              notes: approved ? undefined : "Rejected during admin review.",
            });

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success(result.success ?? "Verification updated.");
      window.location.reload();
    });
  }

  return (
    <Button
      disabled={isPending}
      onClick={submit}
      size="sm"
      type="button"
      variant={approved ? "default" : "outline"}
    >
      {isPending ? <Loader2 className="size-4 animate-spin" /> : null}
      {approved ? "Verify" : "Reject"}
    </Button>
  );
}
