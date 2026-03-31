"use client";

import { useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, SearchCheck } from "lucide-react";
import { z } from "zod";
import { toast } from "sonner";

import { confirmReturnAndComplete } from "@/actions/bookings";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { confirmReturnSchema, type ConfirmReturnInput } from "@/lib/validations";
import type { BookingWithDetails } from "@/types";

interface ConditionCheckFormProps {
  booking: BookingWithDetails;
}

const conditionSchema = confirmReturnSchema.refine(
  (values) =>
    !["damaged", "missing_parts"].includes(values.return_condition) ||
    Boolean(values.return_condition_notes?.trim()),
  {
    message: "Condition notes are required for damaged items or missing parts.",
    path: ["return_condition_notes"],
  },
);

const conditionDescriptions: Record<
  ConfirmReturnInput["return_condition"],
  string
> = {
  excellent: "Item returned in perfect condition",
  good: "Minor wear, as expected from normal use",
  fair: "Some wear beyond normal use",
  damaged: "Item has been damaged",
  missing_parts: "Parts or accessories are missing",
};

export function ConditionCheckForm({ booking }: ConditionCheckFormProps) {
  const [isPending, startTransition] = useTransition();
  const form = useForm<z.infer<typeof conditionSchema>>({
    resolver: zodResolver(conditionSchema),
    defaultValues: {
      booking_id: booking.id,
      return_condition: "good",
      return_condition_notes: "",
    },
  });
  const condition = useWatch({
    control: form.control,
    name: "return_condition",
  });
  const needsWarning =
    condition === "damaged" || condition === "missing_parts";

  async function onSubmit(values: z.infer<typeof conditionSchema>) {
    const formData = new FormData();
    formData.set("booking_id", values.booking_id);
    formData.set("return_condition", values.return_condition);
    formData.set("return_condition_notes", values.return_condition_notes ?? "");

    startTransition(async () => {
      const result = await confirmReturnAndComplete(null, formData);

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success(result.success ?? "Booking completed.");
      window.location.reload();
    });
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button type="button">
          <SearchCheck className="size-4" />
          Inspect & Complete
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Inspect Returned Item</DialogTitle>
          <DialogDescription>
            Confirm the condition of the returned item before completing the booking.
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-5" onSubmit={form.handleSubmit(onSubmit)}>
          <input type="hidden" {...form.register("booking_id")} />

          <div className="flex gap-4 rounded-2xl border border-border/70 bg-muted/20 p-4">
            <div className="size-20 overflow-hidden rounded-xl bg-muted">
              {booking.listing.images[0] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  alt={booking.listing.title}
                  className="h-full w-full object-cover"
                  src={booking.listing.images[0]}
                />
              ) : null}
            </div>
            <div>
              <p className="font-medium">{booking.listing.title}</p>
              <p className="text-sm text-muted-foreground">
                Booking #{booking.id.slice(0, 8)}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Condition</Label>
            <Select
              onValueChange={(value) =>
                form.setValue("return_condition", value as ConfirmReturnInput["return_condition"], {
                  shouldValidate: true,
                })
              }
              value={condition}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select condition" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(conditionDescriptions).map(([value, description]) => (
                  <SelectItem key={value} value={value}>
                    {value.replaceAll("_", " ")} - {description}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-2xl border border-border/70 bg-muted/20 p-4 text-sm text-muted-foreground">
            {conditionDescriptions[condition]}
          </div>

          <div className="space-y-2">
            <Label htmlFor={`condition-notes-${booking.id}`}>Condition Notes</Label>
            <Textarea
              id={`condition-notes-${booking.id}`}
              rows={4}
              {...form.register("return_condition_notes")}
            />
            {form.formState.errors.return_condition_notes?.message ? (
              <p className="text-xs text-destructive">
                {form.formState.errors.return_condition_notes.message}
              </p>
            ) : null}
          </div>

          {needsWarning ? (
            <Alert variant="destructive">
              <AlertDescription>
                The renter&apos;s security deposit may be affected. Provide detailed notes.
              </AlertDescription>
            </Alert>
          ) : null}

          <DialogFooter>
            <Button disabled={isPending} type="submit">
              {isPending ? <Loader2 className="size-4 animate-spin" /> : null}
              Complete Booking
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
