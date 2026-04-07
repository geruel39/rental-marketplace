"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CircleCheckBig } from "lucide-react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { payoutMethodSchema, type PayoutMethodInput } from "@/lib/validations";

type GCashFormProps = {
  defaultValues?: Partial<PayoutMethodInput>;
  onSubmit: (data: PayoutMethodInput) => void | Promise<void>;
  isPending?: boolean;
};

function formatMobileNumber(value: string) {
  const digitsOnly = value.replace(/\D/g, "").slice(0, 11);
  if (digitsOnly.length <= 4) return digitsOnly;
  if (digitsOnly.length <= 7) {
    return `${digitsOnly.slice(0, 4)} ${digitsOnly.slice(4)}`;
  }

  return `${digitsOnly.slice(0, 4)} ${digitsOnly.slice(4, 7)} ${digitsOnly.slice(7)}`;
}

export function GCashForm({
  defaultValues,
  onSubmit,
  isPending = false,
}: GCashFormProps) {
  const form = useForm<PayoutMethodInput>({
    resolver: zodResolver(payoutMethodSchema),
    defaultValues: {
      method: "gcash",
      gcash_phone_number: formatMobileNumber(defaultValues?.gcash_phone_number ?? ""),
    },
  });

  return (
    <form
      className="space-y-5"
      onSubmit={form.handleSubmit(async (values) => {
        await onSubmit({
          ...values,
          method: "gcash",
          gcash_phone_number: values.gcash_phone_number?.replace(/\s/g, "") ?? "",
        });
      })}
    >
      <input type="hidden" {...form.register("method")} value="gcash" />

      <div className="space-y-2">
        <Label htmlFor="gcash_phone_number">GCash Phone Number</Label>
        <div className="flex items-center rounded-md border border-input bg-white shadow-xs focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/20">
          <span className="pl-3 text-lg" role="img" aria-label="Philippines flag">
            🇵🇭
          </span>
          <Input
            className="border-0 shadow-none focus-visible:ring-0"
            id="gcash_phone_number"
            inputMode="numeric"
            placeholder="09XX XXX XXXX"
            value={formatMobileNumber(form.watch("gcash_phone_number") ?? "")}
            onChange={(event) => {
              form.setValue(
                "gcash_phone_number",
                formatMobileNumber(event.target.value),
                { shouldDirty: true, shouldValidate: true },
              );
            }}
          />
        </div>
        {form.formState.errors.gcash_phone_number ? (
          <p className="text-sm text-destructive">
            {form.formState.errors.gcash_phone_number.message}
          </p>
        ) : null}
      </div>

      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
        <p className="flex items-start gap-2">
          <CircleCheckBig className="mt-0.5 size-4 shrink-0" />
          <span>No verification needed. You can create listings immediately.</span>
        </p>
      </div>

      <Button
        className="w-full bg-brand-navy text-white hover:bg-brand-steel"
        disabled={isPending}
        type="submit"
      >
        Save GCash Account
      </Button>
    </form>
  );
}
