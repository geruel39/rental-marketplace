"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, ShieldOff } from "lucide-react";

import {
  suspendUser,
  toggleAdminRole,
  unsuspendUser,
  updateUserAdminNotes,
} from "@/actions/admin";
import { UserSuspendDialog } from "@/components/admin/user-suspend-dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { Profile } from "@/types";

type AdminUserDetailActionsProps = {
  user: Profile;
};

export function AdminUserDetailActions({ user }: AdminUserDetailActionsProps) {
  const router = useRouter();
  const [notes, setNotes] = useState(user.admin_notes ?? "");
  const [isPending, startTransition] = useTransition();

  function runAction(task: () => Promise<void>) {
    startTransition(async () => {
      await task();
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-3">
        {user.is_suspended ? (
          <Button
            onClick={() =>
              runAction(async () => {
                await unsuspendUser(user.id);
              })
            }
            variant="outline"
          >
            Unsuspend User
          </Button>
        ) : (
          <UserSuspendDialog
            onConfirm={async (reason) => {
              await suspendUser(user.id, reason);
              router.refresh();
            }}
            trigger={<Button variant="destructive">Suspend User</Button>}
            user={user}
          />
        )}

        <Button
          onClick={() =>
            runAction(async () => {
              await toggleAdminRole(user.id, !user.is_admin);
            })
          }
          variant="outline"
        >
          {user.is_admin ? (
            <>
              <ShieldOff className="size-4" />
              Remove Admin
            </>
          ) : (
            <>
              <ShieldCheck className="size-4" />
              Make Admin
            </>
          )}
        </Button>
      </div>

      <div className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Admin Notes</h2>
          <p className="text-sm text-muted-foreground">
            Internal-only notes for moderation history and account context.
          </p>
        </div>
        <Textarea
          onChange={(event) => setNotes(event.target.value)}
          placeholder="Add internal notes for this user"
          rows={6}
          value={notes}
        />
        <div className="flex justify-end">
          <Button
            disabled={isPending}
            onClick={() =>
              runAction(async () => {
                await updateUserAdminNotes(user.id, notes);
              })
            }
          >
            {isPending ? "Saving..." : "Save Notes"}
          </Button>
        </div>
      </div>
    </div>
  );
}
