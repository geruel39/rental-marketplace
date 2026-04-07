"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CircleCheckBig } from "lucide-react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { payoutMethodSchema, type PayoutMethodInput } from "@/lib/validations";

type MayaFormProps = {
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

function getRawMobileNumber(value: string) {
  return value.replace(/\D/g, "").slice(0, 11);
}

export function MayaForm({
  defaultValues,
  onSubmit,
  isPending = false,
}: MayaFormProps) {
  const form = useForm<PayoutMethodInput>({
    resolver: zodResolver(payoutMethodSchema),
    defaultValues: {
      method: "maya",
      maya_phone_number: formatMobileNumber(defaultValues?.maya_phone_number ?? ""),
    },
  });

  return (
    <form
      className="space-y-5"
      onSubmit={form.handleSubmit(async (values) => {
        await onSubmit({
          ...values,
          method: "maya",
          maya_phone_number: values.maya_phone_number?.replace(/\s/g, "") ?? "",
        });
      })}
    >
      <input type="hidden" {...form.register("method")} value="maya" />
      <input type="hidden" {...form.register("maya_phone_number")} />

      <div className="space-y-2">
        <Label htmlFor="maya_phone_number">Maya Phone Number</Label>
        <Input
          id="maya_phone_number"
          inputMode="numeric"
          placeholder="09XX XXX XXXX"
          value={formatMobileNumber(form.watch("maya_phone_number") ?? "")}
          onChange={(event) => {
            form.setValue(
              "maya_phone_number",
              getRawMobileNumber(event.target.value),
              { shouldDirty: true, shouldValidate: true },
            );
          }}
        />
        {form.formState.errors.maya_phone_number ? (
          <p className="text-sm text-destructive">
            {form.formState.errors.maya_phone_number.message}
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
        Save Maya Account
      </Button>
    </form>
  );
}
