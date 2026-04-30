"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { markReceivedByRenter } from "@/actions/bookings";
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

interface HandoverDialogProps {
  booking: BookingWithDetails;
  onSuccess?: () => void;
}

export function HandoverDialog({ booking, onSuccess }: HandoverDialogProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [notes, setNotes] = useState("");
  const [proofFiles, setProofFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);

  function submit() {
    if (proofFiles.length < 1) {
      setError("Please upload at least 1 handover photo.");
      return;
    }

    setError(null);
    const formData = new FormData();
    formData.set("booking_id", booking.id);
    formData.set("notes", notes.trim());
    proofFiles.forEach((file) => formData.append("proof_photos", file));

    startTransition(async () => {
      const result = await markReceivedByRenter(null, formData);
      if (result.error) {
        setError(result.error);
        toast.error(result.error);
        return;
      }
      toast.success("Rental started!");
      setOpen(false);
      setNotes("");
      setProofFiles([]);
      onSuccess?.();
    });
  }

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger asChild>
        <Button className="bg-brand-navy text-white hover:bg-brand-steel" type="button">
          Confirm Handover
        </Button>
      </DialogTrigger>
      <DialogContent className="flex max-h-[90vh] flex-col overflow-hidden bg-white sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Confirm Item Handover</DialogTitle>
          <DialogDescription>
            Upload photos as proof that the item has been handed over to the renter. This will start the rental period.
          </DialogDescription>
        </DialogHeader>

        <div
          className="flex-1 space-y-4 overflow-y-scroll pr-2 focus:outline-none"
          style={{ scrollbarGutter: "stable" }}
          tabIndex={0}
        >
          <div className="rounded-xl border bg-white p-3 text-sm shadow-sm">
            <p className="font-medium">{booking.listing.title}</p>
            <p className="text-muted-foreground">
              Renter: {booking.renter.display_name || booking.renter.full_name}
            </p>
            <p className="text-muted-foreground">
              Duration: {booking.rental_units} {booking.pricing_period}
              {booking.rental_units > 1 ? "s" : ""}
            </p>
          </div>

          <Alert>
            <AlertDescription>
              Once you confirm, the rental clock starts. The renter must return the item within {booking.rental_units} {booking.pricing_period}
              {booking.rental_units > 1 ? "s" : ""}.
            </AlertDescription>
          </Alert>

          <ProofPhotoUpload
            description="Take photos of the item being handed over"
            label="Handover Photos"
            onChange={setProofFiles}
            required
          />

          <div className="space-y-2 rounded-xl bg-white">
            <Label htmlFor={`handover-notes-${booking.id}`}>Any notes about the handover</Label>
            <Textarea
              className="bg-white"
              id={`handover-notes-${booking.id}`}
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
            Confirm Handover
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
