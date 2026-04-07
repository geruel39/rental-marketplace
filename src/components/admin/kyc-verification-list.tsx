"use client";

import { useMemo, useState, useTransition } from "react";
import {
  CheckCircle2,
  ExternalLink,
  Eye,
  Search,
  XCircle,
} from "lucide-react";
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatDate, getInitials } from "@/lib/utils";
import type { Profile } from "@/types";

type KycUser = Profile & {
  document_url: string;
  kyc_status: "pending" | "verified" | "rejected";
  last_rejection_reason?: string;
  history: Array<{
    action: string;
    created_at: string;
    notes?: string;
  }>;
};

type KycVerificationListProps = {
  users: KycUser[];
};

function formatDisplayName(user: KycUser) {
  return user.display_name || user.full_name || user.email;
}

function getStatusBadge(status: KycUser["kyc_status"]) {
  switch (status) {
    case "verified":
      return "bg-emerald-100 text-emerald-700 hover:bg-emerald-100";
    case "rejected":
      return "bg-red-100 text-red-700 hover:bg-red-100";
    default:
      return "bg-amber-100 text-amber-700 hover:bg-amber-100";
  }
}

export function KycVerificationList({ users }: KycVerificationListProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | KycUser["kyc_status"]>("all");
  const [rejectReason, setRejectReason] = useState<Record<string, string>>({});
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [viewerUser, setViewerUser] = useState<KycUser | null>(null);
  const [bulkRejectReason, setBulkRejectReason] = useState("");

  const filteredUsers = useMemo(() => {
    const term = search.trim().toLowerCase();

    return users.filter((user) => {
      if (statusFilter !== "all" && user.kyc_status !== statusFilter) {
        return false;
      }

      if (!term) {
        return true;
      }

      return [user.display_name, user.full_name, user.email]
        .filter(Boolean)
        .some((value) => value?.toLowerCase().includes(term));
    });
  }, [search, statusFilter, users]);

  const pendingUsers = filteredUsers.filter((user) => user.kyc_status === "pending");

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
      setSelectedUserIds((current) => current.filter((id) => id !== userId));
      router.refresh();
    });
  }

  async function handleBulkVerify(approved: boolean) {
    if (selectedUserIds.length === 0) {
      toast.error("Select at least one pending submission first.");
      return;
    }

    startTransition(async () => {
      for (const userId of selectedUserIds) {
        const result = await verifyKYC(
          userId,
          approved,
          approved ? undefined : bulkRejectReason || undefined,
        );

        if (result.error) {
          toast.error(result.error);
          return;
        }
      }

      toast.success(
        approved ? "Selected KYC documents approved." : "Selected KYC documents rejected.",
      );
      setSelectedUserIds([]);
      setBulkRejectReason("");
      router.refresh();
    });
  }

  function toggleSelection(userId: string, checked: boolean) {
    setSelectedUserIds((current) =>
      checked ? [...current, userId] : current.filter((id) => id !== userId),
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-3xl border border-border/70 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-1 items-center gap-3 rounded-2xl border border-border/70 px-4 py-2">
            <Search className="size-4 text-muted-foreground" />
            <Input
              className="border-0 px-0 shadow-none focus-visible:ring-0"
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by user name or email"
              value={search}
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {(["all", "pending", "verified", "rejected"] as const).map((filter) => (
              <Button
                key={filter}
                className={statusFilter === filter ? "bg-brand-navy text-white hover:bg-brand-steel" : ""}
                onClick={() => setStatusFilter(filter)}
                size="sm"
                type="button"
                variant={statusFilter === filter ? "default" : "outline"}
              >
                {filter.charAt(0).toUpperCase() + filter.slice(1)}
              </Button>
            ))}
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-brand-navy/10 bg-brand-light p-4 lg:flex-row lg:items-center lg:justify-between">
          <p className="text-sm text-muted-foreground">
            {selectedUserIds.length} selected · {pendingUsers.length} pending in current view
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              className="bg-emerald-600 text-white hover:bg-emerald-700"
              disabled={isPending || selectedUserIds.length === 0}
              onClick={() => void handleBulkVerify(true)}
              type="button"
            >
              Approve Selected
            </Button>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  className="bg-red-600 text-white hover:bg-red-700"
                  disabled={isPending || selectedUserIds.length === 0}
                  type="button"
                >
                  Reject Selected
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Reject selected KYC documents</AlertDialogTitle>
                  <AlertDialogDescription>
                    Add one reason that will be sent to each selected user.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <Textarea
                  onChange={(event) => setBulkRejectReason(event.target.value)}
                  placeholder="Explain what needs to be fixed"
                  rows={4}
                  value={bulkRejectReason}
                />
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <Button
                    className="bg-red-600 text-white hover:bg-red-700"
                    disabled={isPending}
                    onClick={() => void handleBulkVerify(false)}
                    type="button"
                  >
                    Reject Selected
                  </Button>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </div>

      {filteredUsers.map((user) => {
        const canSelect = user.kyc_status === "pending";

        return (
          <div
            key={user.id}
            className="rounded-3xl border border-border/70 bg-white p-6 shadow-sm"
          >
            <div className="flex flex-col gap-5">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div className="flex flex-1 items-start gap-4">
                  <Checkbox
                    checked={selectedUserIds.includes(user.id)}
                    disabled={!canSelect || isPending}
                    onCheckedChange={(checked) => toggleSelection(user.id, checked === true)}
                  />

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
                        <Badge className={getStatusBadge(user.kyc_status)}>
                          {user.kyc_status}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{user.email}</p>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
                      </div>
                      <div className="rounded-2xl border border-brand-navy/10 bg-brand-light p-4 text-sm">
                        <p className="text-xs font-medium uppercase tracking-[0.16em] text-brand-navy">
                          Account Number
                        </p>
                        <p className="mt-1 font-medium text-foreground">
                          {user.bank_account_number || "Not provided"}
                        </p>
                      </div>
                    </div>

                    {user.last_rejection_reason ? (
                      <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                        Last rejection reason: {user.last_rejection_reason}
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row xl:flex-col">
                  {user.document_url ? (
                    <>
                      <Button
                        className="border-brand-navy text-brand-navy hover:bg-brand-light"
                        onClick={() => setViewerUser(user)}
                        type="button"
                        variant="outline"
                      >
                        <Eye className="size-4" />
                        View Document
                      </Button>
                      <Button
                        asChild
                        className="border-brand-navy text-brand-navy hover:bg-brand-light"
                        variant="outline"
                      >
                        <a href={user.document_url} rel="noreferrer" target="_blank">
                          <ExternalLink className="size-4" />
                          Open in New Tab
                        </a>
                      </Button>
                    </>
                  ) : null}

                  {user.kyc_status === "pending" ? (
                    <>
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
                              This will verify the user and unlock bank payouts.
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
                              Provide a short reason so the user knows what to fix.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <Textarea
                            onChange={(event) =>
                              setRejectReason((current) => ({
                                ...current,
                                [user.id]: event.target.value,
                              }))
                            }
                            placeholder="Reason for rejection"
                            rows={4}
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
                    </>
                  ) : null}
                </div>
              </div>

              <div className="rounded-2xl border border-border/70 bg-muted/20 p-4">
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-brand-navy">
                  Verification History
                </p>
                {user.history.length === 0 ? (
                  <p className="mt-2 text-sm text-muted-foreground">
                    No verification actions recorded yet.
                  </p>
                ) : (
                  <div className="mt-3 space-y-2">
                    {user.history.map((entry, index) => (
                      <div
                        key={`${user.id}-${entry.action}-${entry.created_at}-${index}`}
                        className="rounded-xl border border-border/60 bg-white px-4 py-3 text-sm"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-medium text-foreground">
                            {entry.action === "kyc_verified" ? "Verified" : "Rejected"}
                          </span>
                          <span className="text-muted-foreground">
                            {formatDate(entry.created_at)}
                          </span>
                        </div>
                        {entry.notes ? (
                          <p className="mt-2 text-muted-foreground">{entry.notes}</p>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}

      <Dialog onOpenChange={(open) => !open && setViewerUser(null)} open={Boolean(viewerUser)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>
              {viewerUser ? `${formatDisplayName(viewerUser)} · KYC document` : "KYC document"}
            </DialogTitle>
          </DialogHeader>
          {viewerUser?.document_url ? (
            viewerUser.document_url.endsWith(".pdf") ? (
              <iframe
                className="h-[70vh] w-full rounded-2xl border border-border/70"
                src={viewerUser.document_url}
                title="KYC document preview"
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                alt="KYC document preview"
                className="max-h-[70vh] w-full rounded-2xl object-contain"
                src={viewerUser.document_url}
              />
            )
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
