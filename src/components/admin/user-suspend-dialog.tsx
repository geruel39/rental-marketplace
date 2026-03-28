"use client";

import { useMemo, useState, useTransition } from "react";
import { AlertTriangle } from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { Profile } from "@/types";

type UserSuspendDialogProps = {
  user: Profile;
  onConfirm: (reason: string) => Promise<void> | void;
  trigger: React.ReactNode;
};

export function UserSuspendDialog({
  user,
  onConfirm,
  trigger,
}: UserSuspendDialogProps) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [isPending, startTransition] = useTransition();

  const displayName = useMemo(
    () => user.display_name || user.full_name || user.email,
    [user.display_name, user.email, user.full_name],
  );

  return (
    <AlertDialog
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) {
          setReason("");
        }
      }}
      open={open}
    >
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="mb-3 flex size-11 items-center justify-center rounded-2xl bg-red-100 text-red-700">
            <AlertTriangle className="size-5" />
          </div>
          <AlertDialogTitle>Suspend {displayName}?</AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            <span className="block">
              Suspending this user will pause their active listings and block new booking
              activity until an admin restores access.
            </span>
            <span className="block">
              Provide a reason so the moderation history is clear for the admin team.
            </span>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground" htmlFor="suspend-reason">
            Suspension reason
          </label>
          <Textarea
            id="suspend-reason"
            onChange={(event) => setReason(event.target.value)}
            placeholder="Explain why this account is being suspended"
            rows={4}
            value={reason}
          />
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction asChild>
            <Button
              disabled={isPending || reason.trim().length < 3}
              onClick={(event) => {
                event.preventDefault();
                startTransition(async () => {
                  await onConfirm(reason.trim());
                  setOpen(false);
                  setReason("");
                });
              }}
              variant="destructive"
            >
              {isPending ? "Suspending..." : "Suspend User"}
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
