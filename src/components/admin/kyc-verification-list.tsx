"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, ExternalLink, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { verifyKYC } from "@/actions/payout";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getInitials } from "@/lib/utils";
import type { Profile } from "@/types";

type PendingKycUser = Profile & { document_url: string };

type KycVerificationListProps = {
  users: PendingKycUser[];
};

function formatDisplayName(user: PendingKycUser) {
  return user.display_name || user.full_name || user.email;
}

export function KycVerificationList({ users }: KycVerificationListProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [rejectReason, setRejectReason] = useState<Record<string, string>>({});

  async function handleVerify(userId: string, approved: boolean, notes?: string) {
    startTransition(async () => {
      const result = await verifyKYC(userId, approved, notes);

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success(result.success ?? "KYC updated.");
      if (!approved) {
        setRejectReason((current) => ({ ...current, [userId]: "" }));
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      {users.map((user) => (
        <div
          key={user.id}
          className="rounded-3xl border border-border/70 bg-white p-6 shadow-sm"
        >
          <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-1 items-start gap-4">
              <Avatar className="size-14">
                {user.avatar_url ? (
                  <AvatarImage alt={formatDisplayName(user)} src={user.avatar_url} />
                ) : null}
                <AvatarFallback>{getInitials(formatDisplayName(user))}</AvatarFallback>
              </Avatar>

              <div className="space-y-3">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className="text-lg font-semibold text-brand-dark">
                      {formatDisplayName(user)}
                    </h2>
                    <Badge className="bg-brand-sky text-brand-dark hover:bg-brand-sky">
                      Bank
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{user.email}</p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-brand-navy/10 bg-brand-light p-4 text-sm">
                    <p className="text-xs font-medium uppercase tracking-[0.16em] text-brand-navy">
                      Bank Name
                    </p>
                    <p className="mt-1 font-medium text-foreground">
                      {user.bank_name || "Not provided"}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-brand-navy/10 bg-brand-light p-4 text-sm">
                    <p className="text-xs font-medium uppercase tracking-[0.16em] text-brand-navy">
                      Account Name
                    </p>
                    <p className="mt-1 font-medium text-foreground">
                      {user.bank_account_name || "Not provided"}
                    </p>
                    <p className="mt-1 text-muted-foreground">
                      {user.bank_account_number || "No account number"}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row xl:flex-col">
              <Button
                asChild
                className="border-brand-navy text-brand-navy hover:bg-brand-light"
                variant="outline"
              >
                <a href={user.document_url} rel="noreferrer" target="_blank">
                  <ExternalLink className="size-4" />
                  View Document
                </a>
              </Button>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    className="bg-emerald-600 text-white hover:bg-emerald-700"
                    disabled={isPending}
                    type="button"
                  >
                    <CheckCircle2 className="size-4" />
                    Approve
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Approve KYC verification?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will verify the user and allow them to create listings
                      with bank payouts.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <Button
                      className="bg-emerald-600 text-white hover:bg-emerald-700"
                      disabled={isPending}
                      onClick={() => void handleVerify(user.id, true)}
                      type="button"
                    >
                      Approve KYC
                    </Button>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    className="bg-red-600 text-white hover:bg-red-700"
                    disabled={isPending}
                    type="button"
                  >
                    <XCircle className="size-4" />
                    Reject
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Reject KYC document</AlertDialogTitle>
                    <AlertDialogDescription>
                      Provide a short reason so the user knows what to fix before
                      uploading a new document.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <Input
                    onChange={(event) =>
                      setRejectReason((current) => ({
                        ...current,
                        [user.id]: event.target.value,
                      }))
                    }
                    placeholder="Reason for rejection"
                    value={rejectReason[user.id] ?? ""}
                  />
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <Button
                      className="bg-red-600 text-white hover:bg-red-700"
                      disabled={isPending}
                      onClick={() =>
                        void handleVerify(
                          user.id,
                          false,
                          rejectReason[user.id] || undefined,
                        )
                      }
                      type="button"
                    >
                      Reject KYC
                    </Button>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
