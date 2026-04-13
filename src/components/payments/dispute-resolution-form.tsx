"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { resolveDisputePayment } from "@/actions/payments";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { cn, formatCurrency } from "@/lib/utils";
import type { ActionResponse, BookingWithDetails, DisputeResolutionType } from "@/types";

type DisputeResolutionFormProps = {
  booking: BookingWithDetails;
  onSuccess?: () => void;
};

const initialState: ActionResponse = {};

export function DisputeResolutionForm({
  booking,
  onSuccess,
}: DisputeResolutionFormProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [resolutionType, setResolutionType] =
    useState<DisputeResolutionType>("full_refund_renter");
  const [renterPercent, setRenterPercent] = useState(50);
  const [listerPercent, setListerPercent] = useState(50);

  const [state, formAction, isPending] = useActionState<ActionResponse, FormData>(
    async (_prevState, formData) => {
      const type = formData.get("resolution_type");
      const notes = formData.get("resolution_notes")?.toString().trim() ?? "";
      const evidence = formData.get("evidence_reviewed")?.toString().trim() ?? "";
      const renter = Number(formData.get("renter_percent") ?? 0);
      const lister = Number(formData.get("lister_percent") ?? 0);

      if (
        type !== "full_refund_renter" &&
        type !== "full_payout_lister" &&
        type !== "split"
      ) {
        return { error: "Choose a resolution type." };
      }

      if (notes.length < 10) {
        return { error: "Resolution notes must be at least 10 characters." };
      }

      if (type === "split" && renter + lister !== 100) {
        return { error: "Renter and lister percentages must add up to 100." };
      }

      return resolveDisputePayment({
        bookingId: booking.id,
        adminId: "self",
        resolutionType: type,
        renterRefundPercent: type === "split" ? renter : undefined,
        listerPayoutPercent: type === "split" ? lister : undefined,
        resolutionNotes: notes,
        evidenceReviewed: evidence || undefined,
      });
    },
    initialState,
  );

  useEffect(() => {
    if (state.error) {
      toast.error(state.error);
    }

    if (state.success) {
      toast.success(state.success);
      setOpen(false);
      router.refresh();
      onSuccess?.();
    }
  }, [onSuccess, router, state]);

  const resolutionPreview = useMemo(() => {
    if (resolutionType === "full_refund_renter") {
      return { renter: booking.total_price, lister: 0 };
    }

    if (resolutionType === "full_payout_lister") {
      return { renter: 0, lister: booking.lister_payout };
    }

    const distributable = booking.net_collected ?? booking.total_price;
    return {
      renter: distributable * (renterPercent / 100),
      lister: distributable * (listerPercent / 100),
    };
  }, [
    booking.lister_payout,
    booking.net_collected,
    booking.total_price,
    listerPercent,
    renterPercent,
    resolutionType,
  ]);

  function syncRenterPercent(value: number) {
    const safe = Math.max(0, Math.min(100, value));
    setRenterPercent(safe);
    setListerPercent(100 - safe);
  }

  function syncListerPercent(value: number) {
    const safe = Math.max(0, Math.min(100, value));
    setListerPercent(safe);
    setRenterPercent(100 - safe);
  }

  const participants = {
    renter: booking.renter.display_name || booking.renter.full_name || booking.renter.email,
    lister: booking.lister.display_name || booking.lister.full_name || booking.lister.email,
  };

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger asChild>
        <Button className="bg-brand-navy text-white hover:bg-brand-steel" type="button">
          Resolve Dispute
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Dispute Resolution</DialogTitle>
          <DialogDescription>
            Decide how the funds should be released for this disputed booking.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-6">
          <input name="resolution_type" type="hidden" value={resolutionType} />
          <input name="renter_percent" type="hidden" value={String(renterPercent)} />
          <input name="lister_percent" type="hidden" value={String(listerPercent)} />

          <section className="rounded-2xl border border-border/70 bg-slate-50 p-4">
            <p className="font-medium text-foreground">{booking.listing.title}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Renter: {participants.renter} | Lister: {participants.lister}
            </p>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                  Total paid
                </p>
                <p className="mt-1 font-semibold text-brand-navy">
                  {formatCurrency(booking.total_price)}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                  Lister payout
                </p>
                <p className="mt-1 font-semibold text-brand-navy">
                  {formatCurrency(booking.lister_payout)}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                  Booking status
                </p>
                <p className="mt-1 font-semibold capitalize text-foreground">
                  {booking.status.replaceAll("_", " ")}
                </p>
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <Label className="text-base font-semibold text-foreground">Resolution type</Label>
            <RadioGroup
              className="space-y-3"
              onValueChange={(value) => setResolutionType(value as DisputeResolutionType)}
              value={resolutionType}
            >
              {[
                {
                  value: "full_refund_renter",
                  label: "Full Refund to Renter",
                  description: "Renter gets everything back",
                },
                {
                  value: "full_payout_lister",
                  label: "Full Payout to Lister",
                  description: "Lister gets their full payout",
                },
                {
                  value: "split",
                  label: "Split Decision",
                  description: "Custom percentage split between both parties",
                },
              ].map((option) => (
                <label
                  className={cn(
                    "flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition-colors",
                    resolutionType === option.value
                      ? "border-brand-navy bg-brand-navy/5"
                      : "border-border/70 bg-white",
                  )}
                  key={option.value}
                >
                  <RadioGroupItem value={option.value} />
                  <div>
                    <p className="font-medium text-foreground">{option.label}</p>
                    <p className="text-sm text-muted-foreground">{option.description}</p>
                  </div>
                </label>
              ))}
            </RadioGroup>
          </section>

          {resolutionType === "split" ? (
            <section className="space-y-4 rounded-2xl border border-brand-sky/30 bg-sky-50/60 p-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="renter-percent">Renter %</Label>
                  <Input
                    id="renter-percent"
                    max={100}
                    min={0}
                    onChange={(event) => syncRenterPercent(Number(event.target.value))}
                    type="number"
                    value={renterPercent}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lister-percent">Lister %</Label>
                  <Input
                    id="lister-percent"
                    max={100}
                    min={0}
                    onChange={(event) => syncListerPercent(Number(event.target.value))}
                    type="number"
                    value={listerPercent}
                  />
                </div>
              </div>
              <input
                className="w-full accent-[#003e86]"
                max={100}
                min={0}
                onChange={(event) => syncRenterPercent(Number(event.target.value))}
                type="range"
                value={renterPercent}
              />
              <p
                className={cn(
                  "text-sm",
                  renterPercent + listerPercent === 100
                    ? "text-muted-foreground"
                    : "text-rose-600",
                )}
              >
                Renter {renterPercent}% | Lister {listerPercent}% {renterPercent + listerPercent === 100 ? "" : "(must equal 100)"}
              </p>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-2xl bg-white p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                    Renter receives
                  </p>
                  <p className="mt-2 text-lg font-semibold text-brand-sky">
                    {formatCurrency(resolutionPreview.renter)}
                  </p>
                </div>
                <div className="rounded-2xl bg-white p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                    Lister receives
                  </p>
                  <p className="mt-2 text-lg font-semibold text-brand-navy">
                    {formatCurrency(resolutionPreview.lister)}
                  </p>
                </div>
              </div>
            </section>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="evidence_reviewed">Evidence reviewed</Label>
            <Textarea
              id="evidence_reviewed"
              name="evidence_reviewed"
              placeholder="Screenshots, messages, photos, condition reports, pickup logs..."
              rows={4}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="resolution_notes">Resolution notes</Label>
            <Textarea
              id="resolution_notes"
              name="resolution_notes"
              placeholder="Document why this decision is fair and what each party should expect next."
              required
              rows={5}
            />
          </div>

          <section className="rounded-2xl border border-brand-navy/20 bg-brand-navy/5 p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-brand-navy">
              Final confirmation
            </p>
            <p className="mt-2 text-sm text-foreground">
              Renter receives:{" "}
              <span className="font-semibold text-brand-sky">
                {formatCurrency(resolutionPreview.renter)}
              </span>{" "}
              | Lister receives:{" "}
              <span className="font-semibold text-brand-navy">
                {formatCurrency(resolutionPreview.lister)}
              </span>
            </p>
          </section>

          <DialogFooter>
            <Button onClick={() => setOpen(false)} type="button" variant="outline">
              Cancel
            </Button>
            <Button
              className="bg-brand-navy text-white hover:bg-brand-steel"
              disabled={isPending}
              type="submit"
            >
              {isPending ? "Confirming..." : "Confirm Resolution"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
