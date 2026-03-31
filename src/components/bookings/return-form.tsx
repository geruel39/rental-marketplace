"use client";

import { useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Undo2 } from "lucide-react";
import { toast } from "sonner";

import { initiateReturn } from "@/actions/bookings";
import { SchedulePicker } from "@/components/bookings/schedule-picker";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { returnItemSchema, type ReturnItemInput } from "@/lib/validations";
import type { BookingWithDetails } from "@/types";

interface ReturnFormProps {
  booking: BookingWithDetails;
}

export function ReturnForm({ booking }: ReturnFormProps) {
  const [isPending, startTransition] = useTransition();
  const form = useForm<ReturnItemInput>({
    resolver: zodResolver(returnItemSchema),
    defaultValues: {
      booking_id: booking.id,
      return_method: "pickup_by_lister",
      return_notes: "",
      return_scheduled_at: booking.return_scheduled_at ?? "",
    },
  });
  const returnMethod = useWatch({
    control: form.control,
    name: "return_method",
  });
  const returnScheduledAt = useWatch({
    control: form.control,
    name: "return_scheduled_at",
  });

  async function onSubmit(values: ReturnItemInput) {
    const formData = new FormData();
    formData.set("booking_id", values.booking_id);
    formData.set("return_method", values.return_method);
    formData.set("return_scheduled_at", values.return_scheduled_at);
    formData.set("return_notes", values.return_notes ?? "");

    startTransition(async () => {
      const result = await initiateReturn(null, formData);

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success(result.success ?? "Return scheduled.");
      form.reset(values);
      window.location.reload();
    });
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button type="button" variant="outline">
          <Undo2 className="size-4" />
          Schedule Return
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Schedule Return</DialogTitle>
          <DialogDescription>
            Choose how and when this item will be returned.
          </DialogDescription>
        </DialogHeader>

        <form
          className="space-y-5"
          onSubmit={form.handleSubmit(onSubmit)}
        >
          <input type="hidden" {...form.register("booking_id")} />

          {form.formState.errors.root?.message ? (
            <Alert variant="destructive">
              <AlertDescription>{form.formState.errors.root.message}</AlertDescription>
            </Alert>
          ) : null}

          <div className="space-y-3">
            <Label>Return Method</Label>
            <RadioGroup
              onValueChange={(value) =>
                form.setValue("return_method", value as ReturnItemInput["return_method"])
              }
              value={returnMethod}
            >
              <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-border/70 p-4">
                <RadioGroupItem value="pickup_by_lister" />
                <div>
                  <p className="font-medium">Lister picks up</p>
                  <p className="text-sm text-muted-foreground">
                    Lister comes to get the item
                  </p>
                </div>
              </label>
              <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-border/70 p-4">
                <RadioGroupItem value="dropoff_by_renter" />
                <div>
                  <p className="font-medium">I&apos;ll drop off</p>
                  <p className="text-sm text-muted-foreground">
                    Return to lister&apos;s location
                  </p>
                </div>
              </label>
            </RadioGroup>
          </div>

          <SchedulePicker
            error={form.formState.errors.return_scheduled_at?.message}
            label="Return Date and Time"
            minDate={new Date()}
            onChange={(iso) => form.setValue("return_scheduled_at", iso, { shouldValidate: true })}
            value={returnScheduledAt}
          />

          <div className="space-y-2">
            <Label htmlFor={`return-notes-${booking.id}`}>Return Notes</Label>
            <Textarea
              id={`return-notes-${booking.id}`}
              rows={4}
              {...form.register("return_notes")}
            />
          </div>

          <DialogFooter>
            <Button disabled={isPending} type="submit">
              {isPending ? <Loader2 className="size-4 animate-spin" /> : null}
              Schedule Return
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
