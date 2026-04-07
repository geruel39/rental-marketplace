"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Info } from "lucide-react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { payoutMethodSchema, type PayoutMethodInput } from "@/lib/validations";

type BankAccountFormProps = {
  defaultValues?: Partial<PayoutMethodInput>;
  onSubmit: (data: PayoutMethodInput) => void | Promise<void>;
  isPending?: boolean;
};

const commonBanks = [
  "BDO Unibank",
  "BPI",
  "Metrobank",
  "Land Bank of the Philippines",
  "PNB",
  "Security Bank",
  "UnionBank",
  "RCBC",
  "China Bank",
  "EastWest Bank",
];

function formatAccountNumber(value: string) {
  const digitsOnly = value.replace(/\D/g, "").slice(0, 24);
  return digitsOnly.replace(/(.{4})/g, "$1 ").trim();
}

export function BankAccountForm({
  defaultValues,
  onSubmit,
  isPending = false,
}: BankAccountFormProps) {
  const form = useForm<PayoutMethodInput>({
    resolver: zodResolver(payoutMethodSchema),
    defaultValues: {
      method: "bank",
      bank_name: defaultValues?.bank_name ?? "",
      bank_account_number: defaultValues?.bank_account_number ?? "",
      bank_account_name: defaultValues?.bank_account_name ?? "",
    },
  });

  return (
    <form
      className="space-y-5"
      onSubmit={form.handleSubmit(async (values) => {
        await onSubmit({
          ...values,
          method: "bank",
          bank_account_number: values.bank_account_number?.replace(/\s/g, "") ?? "",
        });
      })}
    >
      <input type="hidden" {...form.register("method")} value="bank" />

      <div className="space-y-2">
        <Label htmlFor="bank_name">Bank Name</Label>
        <Input
          id="bank_name"
          list="bank-name-suggestions"
          placeholder="Select or type your bank"
          {...form.register("bank_name")}
        />
        <datalist id="bank-name-suggestions">
          {commonBanks.map((bank) => (
            <option key={bank} value={bank} />
          ))}
        </datalist>
        {form.formState.errors.bank_name ? (
          <p className="text-sm text-destructive">
            {form.formState.errors.bank_name.message}
          </p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="bank_account_number">Account Number</Label>
        <Input
          id="bank_account_number"
          inputMode="numeric"
          placeholder="1234 5678 9012"
          value={formatAccountNumber(form.watch("bank_account_number") ?? "")}
          onChange={(event) => {
            form.setValue(
              "bank_account_number",
              formatAccountNumber(event.target.value),
              { shouldDirty: true, shouldValidate: true },
            );
          }}
        />
        {form.formState.errors.bank_account_number ? (
          <p className="text-sm text-destructive">
            {form.formState.errors.bank_account_number.message}
          </p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="bank_account_name">Account Name</Label>
        <Input
          id="bank_account_name"
          placeholder="Juan Dela Cruz"
          {...form.register("bank_account_name")}
        />
        <p className="text-xs text-muted-foreground">
          This should ideally match the legal name on your bank account.
        </p>
        {form.formState.errors.bank_account_name ? (
          <p className="text-sm text-destructive">
            {form.formState.errors.bank_account_name.message}
          </p>
        ) : null}
      </div>

      <div className="rounded-2xl border border-brand-sky/20 bg-brand-sky/10 p-4 text-sm text-brand-navy">
        <p className="flex items-start gap-2">
          <Info className="mt-0.5 size-4 shrink-0 text-brand-sky" />
          <span>
            You&apos;ll need to upload a government ID for verification after
            saving.
          </span>
        </p>
      </div>

      <Button
        className="w-full bg-brand-navy text-white hover:bg-brand-steel"
        disabled={isPending}
        type="submit"
      >
        Save Bank Details
      </Button>
    </form>
  );
}
