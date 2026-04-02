"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { formatDistanceToNowStrict } from "date-fns";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { markReturnedToLister } from "@/actions/bookings";
import { ProofPhotoUpload } from "@/components/bookings/proof-photo-upload";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
import type { BookingWithDetails } from "@/types";

interface ReturnDialogProps {
  booking: BookingWithDetails;
  onSuccess?: () => void;
}

export function ReturnDialog({ booking, onSuccess }: ReturnDialogProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [notes, setNotes] = useState("");
  const [proofFiles, setProofFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const deadline = useMemo(
    () => (booking.rental_ends_at ? new Date(booking.rental_ends_at) : null),
    [booking.rental_ends_at],
  );
  const isLate = Boolean(deadline && now > deadline.getTime());
  const remainingText =
    deadline && !isLate
      ? formatDistanceToNowStrict(deadline, { addSuffix: true })
      : null;
  const lateText =
    deadline && isLate
      ? formatDistanceToNowStrict(deadline, { addSuffix: true })
      : null;

  function submit() {
    if (proofFiles.length < 1) {
      setError("Please upload at least 1 return photo.");
      return;
    }

    setError(null);
    const formData = new FormData();
    formData.set("booking_id", booking.id);
    formData.set("notes", notes.trim());
    proofFiles.forEach((file) => formData.append("proof_photos", file));

    startTransition(async () => {
      const result = await markReturnedToLister(null, formData);
      if (result.error) {
        setError(result.error);
        toast.error(result.error);
        return;
      }
      toast.success("Return confirmed!");
      setOpen(false);
      setNotes("");
      setProofFiles([]);
      onSuccess?.();
    });
  }

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline">
          Confirm Return
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Confirm Item Return</DialogTitle>
          <DialogDescription>
            Upload photos as proof that you&apos;ve returned the item to the lister.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-xl border bg-muted/20 p-3 text-sm">
            <p className="font-medium">{booking.listing.title}</p>
            <p className="text-muted-foreground">
              Duration: {booking.rental_units} {booking.pricing_period}
              {booking.rental_units > 1 ? "s" : ""}
            </p>
          </div>

          {isLate && deadline ? (
            <Alert variant="destructive">
              <AlertDescription>
                This return is LATE. The deadline was {deadline.toLocaleString()} ({lateText}).
              </AlertDescription>
            </Alert>
          ) : deadline ? (
            <Alert>
              <AlertDescription>Time remaining: {remainingText}</AlertDescription>
            </Alert>
          ) : null}

          <ProofPhotoUpload
            description="Take photos showing the item has been returned"
            label="Return Photos"
            onChange={setProofFiles}
            required
          />

          <div className="space-y-2">
            <Label htmlFor={`return-notes-${booking.id}`}>Any notes about the return</Label>
            <Textarea
              id={`return-notes-${booking.id}`}
              maxLength={500}
              onChange={(event) => setNotes(event.target.value)}
              rows={3}
              value={notes}
            />
          </div>

          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
        </div>

        <DialogFooter>
          <Button
            className="bg-brand-navy text-white hover:bg-brand-steel"
            disabled={isPending}
            onClick={submit}
            type="button"
          >
            {isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
            Confirm Return
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
