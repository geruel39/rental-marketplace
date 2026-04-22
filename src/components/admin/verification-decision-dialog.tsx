"use client";

import { useMemo, useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { rejectVerification } from "@/actions/verification";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { AccountType } from "@/types";

const individualFields = [
  { key: "gov_id_front", label: "Government ID (Front)" },
  { key: "gov_id_back", label: "Government ID (Back)" },
  { key: "selfie", label: "Selfie" },
  { key: "other", label: "Other" },
] as const;

const businessFields = [
  { key: "business_address", label: "Business Address" },
  { key: "tin", label: "TIN" },
  { key: "business_document", label: "Business Document" },
  { key: "rep_gov_id_front", label: "Rep Gov ID (Front)" },
  { key: "rep_gov_id_back", label: "Rep Gov ID (Back)" },
  { key: "rep_selfie", label: "Rep Selfie" },
  { key: "other", label: "Other" },
] as const;

interface VerificationDecisionDialogProps {
  userId: string;
  accountType: AccountType;
  userName: string;
  onConfirm?: () => void;
}

export function VerificationDecisionDialog({
  userId,
  accountType,
  userName,
  onConfirm,
}: VerificationDecisionDialogProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [reason, setReason] = useState("");
  const [selectedFields, setSelectedFields] = useState<string[]>([]);
  const [fieldReasons, setFieldReasons] = useState<Record<string, string>>({});

  const fields = useMemo(
    () => (accountType === "individual" ? individualFields : businessFields),
    [accountType],
  );

  function toggleField(field: string, checked: boolean) {
    setSelectedFields((current) =>
      checked ? [...current, field] : current.filter((item) => item !== field),
    );
  }

  function submit() {
    const trimmedReason = reason.trim();
    if (trimmedReason.length < 3) {
      toast.error("Please enter a rejection reason.");
      return;
    }

    if (selectedFields.length === 0) {
      toast.error("Select at least one item to resubmit.");
      return;
    }

    const selectedLabels = fields
      .filter((field) => selectedFields.includes(field.key))
      .map((field) => {
        const fieldReason = fieldReasons[field.key]?.trim();
        return fieldReason ? `- ${field.label}: ${fieldReason}` : `- ${field.label}`;
      });

    const composedReason = `${trimmedReason}\n\nPlease resubmit:\n${selectedLabels.join("\n")}`;

    startTransition(async () => {
      const result = await rejectVerification(
        userId,
        accountType,
        composedReason,
        selectedFields,
      );

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success(result.success ?? "Verification rejected.");
      setOpen(false);
      if (onConfirm) {
        onConfirm();
      } else {
        window.location.reload();
      }
    });
  }

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger asChild>
        <Button type="button" variant="destructive">
          Reject with Reason
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Reject Verification for {userName}</DialogTitle>
          <DialogDescription>
            Tell the user what needs to be corrected before they resubmit.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor={`verification-reason-${userId}`}>Overall rejection reason</Label>
            <Textarea
              id={`verification-reason-${userId}`}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Explain what needs to be fixed."
              rows={4}
              value={reason}
            />
          </div>

          <div className="space-y-3">
            <p className="text-sm font-medium">Which items should be resubmitted?</p>
            {fields.map((field) => {
              const checked = selectedFields.includes(field.key);

              return (
                <div className="space-y-2 rounded-xl border border-border/70 p-3" key={field.key}>
                  <div className="flex items-center gap-3">
                    <Checkbox
                      checked={checked}
                      id={`${userId}-${field.key}`}
                      onCheckedChange={(value) => toggleField(field.key, value === true)}
                    />
                    <Label htmlFor={`${userId}-${field.key}`}>{field.label}</Label>
                  </div>

                  {checked ? (
                    <Textarea
                      onChange={(event) =>
                        setFieldReasons((current) => ({
                          ...current,
                          [field.key]: event.target.value,
                        }))
                      }
                      placeholder={`Optional notes for ${field.label.toLowerCase()}`}
                      rows={2}
                      value={fieldReasons[field.key] ?? ""}
                    />
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>

        <DialogFooter>
          <Button disabled={isPending} onClick={submit} type="button" variant="destructive">
            {isPending ? <Loader2 className="size-4 animate-spin" /> : null}
            Send Rejection & Notify User
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
