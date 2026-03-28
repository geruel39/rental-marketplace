"use client";

import { useState, useTransition } from "react";

import { moderateListing } from "@/actions/admin";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import type { Listing } from "@/types";

type ListingModerateDialogProps = {
  listing: Listing;
  action: "approve" | "reject" | "flag";
  ownerName?: string;
  trigger: React.ReactNode;
  onComplete?: () => void;
};

const actionLabels: Record<ListingModerateDialogProps["action"], string> = {
  approve: "Approve",
  reject: "Reject",
  flag: "Flag",
};

const actionButtonClass: Record<ListingModerateDialogProps["action"], string> = {
  approve: "bg-emerald-600 text-white hover:bg-emerald-700",
  reject: "bg-red-600 text-white hover:bg-red-700",
  flag: "bg-amber-500 text-black hover:bg-amber-600",
};

export function ListingModerateDialog({
  listing,
  action,
  ownerName,
  trigger,
  onComplete,
}: ListingModerateDialogProps) {
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const [isPending, startTransition] = useTransition();

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{actionLabels[action]} listing</DialogTitle>
          <DialogDescription>
            Review the listing preview below and include moderation notes for the audit trail.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-4 rounded-2xl border border-orange-100 bg-orange-50/30 p-4">
          <div className="size-20 overflow-hidden rounded-xl bg-muted">
            {listing.images[0] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                alt={listing.title}
                className="h-full w-full object-cover"
                src={listing.images[0]}
              />
            ) : null}
          </div>
          <div className="space-y-1">
            <p className="font-medium text-foreground">{listing.title}</p>
            <p className="text-sm text-muted-foreground">{ownerName || "Owner unavailable"}</p>
            <p className="text-sm text-muted-foreground">
              Status: {listing.status} · Moderation: {listing.moderation_status}
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground" htmlFor={`moderation-${action}`}>
            Moderation notes
          </label>
          <Textarea
            id={`moderation-${action}`}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Add context for this moderation decision"
            rows={5}
            value={notes}
          />
        </div>

        <DialogFooter>
          <Button onClick={() => setOpen(false)} type="button" variant="outline">
            Cancel
          </Button>
          <Button
            className={actionButtonClass[action]}
            disabled={isPending}
            onClick={() =>
              startTransition(async () => {
                await moderateListing(listing.id, action, notes);
                setOpen(false);
                setNotes("");
                onComplete?.();
              })
            }
            type="button"
          >
            {isPending ? `${actionLabels[action]}ing...` : `${actionLabels[action]} Listing`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
