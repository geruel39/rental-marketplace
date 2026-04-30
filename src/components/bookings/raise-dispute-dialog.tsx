"use client";

import { useState, useTransition } from "react";
import { ShieldAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { raiseDispute } from "@/actions/bookings";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface RaiseDisputeDialogProps {
  bookingId: string;
  buttonClassName?: string;
  buttonVariant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
  buttonSize?: "default" | "sm" | "lg" | "icon";
  fullWidth?: boolean;
}

export function RaiseDisputeDialog({
  bookingId,
  buttonClassName,
  buttonVariant = "outline",
  buttonSize = "default",
  fullWidth = false,
}: RaiseDisputeDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [isPending, startTransition] = useTransition();

  function submit() {
    const trimmedReason = reason.trim();
    if (trimmedReason.length < 5) {
      toast.error("Please provide a short reason for the dispute.");
      return;
    }

    startTransition(async () => {
      const result = await raiseDispute(bookingId, trimmedReason);

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success(result.success ?? "Dispute raised.");
      setReason("");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger asChild>
        <Button
          className={fullWidth ? `w-full ${buttonClassName ?? ""}`.trim() : buttonClassName}
          size={buttonSize}
          type="button"
          variant={buttonVariant}
        >
          <ShieldAlert className="size-4" />
          Raise Dispute
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Raise Dispute</DialogTitle>
          <DialogDescription>
            Explain the issue so the platform team can review it.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor={`dispute-reason-${bookingId}`}>Reason</Label>
          <Textarea
            id={`dispute-reason-${bookingId}`}
            onChange={(event) => setReason(event.target.value)}
            rows={4}
            value={reason}
          />
        </div>
        <DialogFooter>
          <Button
            className="min-w-36"
            disabled={isPending || reason.trim().length < 5}
            onClick={submit}
            type="button"
            variant="outline"
          >
            {isPending ? "Submitting..." : "Raise Dispute"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
