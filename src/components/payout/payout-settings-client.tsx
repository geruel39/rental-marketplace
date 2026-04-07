"use client";

import { useState, useTransition } from "react";
import {
  Building,
  CreditCard,
  Loader2,
  Smartphone,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { setupPayoutMethod } from "@/actions/payout";
import { BankAccountForm } from "@/components/payout/bank-account-form";
import { GCashForm } from "@/components/payout/gcash-form";
import { KYCUpload } from "@/components/payout/kyc-upload";
import { MayaForm } from "@/components/payout/maya-form";
import { PayoutMethodSelector } from "@/components/payout/payout-method-selector";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { formatPhoneNumber, getPayoutMethodLabel, maskAccountNumber } from "@/lib/utils";
import { type PayoutMethodInput } from "@/lib/validations";
import type { PayoutMethod, PayoutSetupStatus, Profile } from "@/types";

type PayoutSettingsClientProps = {
  profile: Profile;
  payoutStatus: PayoutSetupStatus;
};

function getMethodIcon(method: PayoutMethod) {
  switch (method) {
    case "bank":
      return Building;
    case "gcash":
      return Smartphone;
    case "maya":
      return CreditCard;
  }
}

function getMethodValue(profile: Profile, method: PayoutMethod) {
  switch (method) {
    case "bank":
      return [
        profile.bank_name || "Bank details saved",
        profile.bank_account_number
          ? `Account ${maskAccountNumber(profile.bank_account_number)}`
          : null,
      ]
        .filter(Boolean)
        .join(" | ");
    case "gcash":
      return profile.gcash_phone_number
        ? formatPhoneNumber(profile.gcash_phone_number)
        : "No number added";
    case "maya":
      return profile.maya_phone_number
        ? formatPhoneNumber(profile.maya_phone_number)
        : "No number added";
  }
}

export function PayoutSettingsClient({
  profile,
  payoutStatus,
}: PayoutSettingsClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selectedMethod, setSelectedMethod] = useState<PayoutMethod | undefined>(
    profile.payout_method,
  );
  const [showSelector, setShowSelector] = useState(!profile.payout_method);

  const activeMethod = showSelector ? selectedMethod : profile.payout_method ?? undefined;
  const shouldShowBankForm =
    selectedMethod === "bank" &&
    (showSelector || profile.payout_method === "bank" || !profile.payout_method);
  const shouldShowGcashForm =
    selectedMethod === "gcash" && (showSelector || !profile.payout_method);
  const shouldShowMayaForm =
    selectedMethod === "maya" && (showSelector || !profile.payout_method);

  async function handleMethodSubmit(data: PayoutMethodInput) {
    startTransition(async () => {
      const formData = new FormData();
      formData.set("method", data.method);

      if (data.bank_name) {
        formData.set("bank_name", data.bank_name);
      }

      if (data.bank_account_number) {
        formData.set("bank_account_number", data.bank_account_number);
      }

      if (data.bank_account_name) {
        formData.set("bank_account_name", data.bank_account_name);
      }

      if (data.gcash_phone_number) {
        formData.set("gcash_phone_number", data.gcash_phone_number);
      }

      if (data.maya_phone_number) {
        formData.set("maya_phone_number", data.maya_phone_number);
      }

      const result = await setupPayoutMethod(null, formData);

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success(result.success ?? "Payout method saved.");
      setSelectedMethod(data.method);
      setShowSelector(data.method === "bank");
      router.refresh();
    });
  }

  const CurrentIcon =
    profile.payout_method ? getMethodIcon(profile.payout_method) : null;

  return (
    <div className="space-y-6">
      {profile.payout_method ? (
        <div className="rounded-3xl border border-brand-navy/10 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-start gap-4">
              {CurrentIcon ? (
                <div className="flex size-12 items-center justify-center rounded-2xl bg-brand-light text-brand-steel">
                  <CurrentIcon className="size-6" />
                </div>
              ) : null}
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="text-lg font-semibold text-brand-navy">Current Method</h2>
                  <Badge className="bg-brand-navy/10 text-brand-navy hover:bg-brand-navy/10">
                    {getPayoutMethodLabel(profile.payout_method)}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  {getMethodValue(profile, profile.payout_method)}
                </p>
              </div>
            </div>

            <Button
              className="border-brand-navy text-brand-navy hover:bg-brand-light"
              onClick={() => {
                setSelectedMethod(undefined);
                setShowSelector(true);
              }}
              type="button"
              variant="outline"
            >
              Change Method
            </Button>
          </div>
        </div>
      ) : null}

      {showSelector ? (
        <div className="space-y-4 rounded-3xl border border-border/70 bg-white p-6 shadow-sm">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-brand-navy">
              Choose Your Payout Method
            </h2>
            <p className="text-sm text-muted-foreground">
              Pick how you want to receive your rental earnings.
            </p>
          </div>
          <PayoutMethodSelector
            currentMethod={selectedMethod}
            onSelect={(method) => setSelectedMethod(method)}
          />
        </div>
      ) : null}

      {shouldShowBankForm ? (
        <div className="rounded-3xl border border-border/70 bg-white p-6 shadow-sm">
          <div className="mb-5 space-y-1">
            <h3 className="text-lg font-semibold text-brand-navy">Bank Account Details</h3>
            <p className="text-sm text-muted-foreground">
              Save your bank details first, then upload a government ID for verification.
            </p>
          </div>
          <BankAccountForm
            defaultValues={{
              method: "bank",
              bank_name: profile.bank_name ?? "",
              bank_account_number: profile.bank_account_number ?? "",
              bank_account_name: profile.bank_account_name ?? "",
            }}
            isPending={isPending}
            onSubmit={handleMethodSubmit}
          />
        </div>
      ) : null}

      {shouldShowGcashForm ? (
        <div className="rounded-3xl border border-border/70 bg-white p-6 shadow-sm">
          <div className="mb-5 space-y-1">
            <h3 className="text-lg font-semibold text-brand-navy">GCash Details</h3>
            <p className="text-sm text-muted-foreground">
              Connect your GCash number to receive lister payouts instantly.
            </p>
          </div>
          <GCashForm
            defaultValues={{
              method: "gcash",
              gcash_phone_number: profile.gcash_phone_number ?? "",
            }}
            isPending={isPending}
            onSubmit={handleMethodSubmit}
          />
        </div>
      ) : null}

      {shouldShowMayaForm ? (
        <div className="rounded-3xl border border-border/70 bg-white p-6 shadow-sm">
          <div className="mb-5 space-y-1">
            <h3 className="text-lg font-semibold text-brand-navy">Maya Details</h3>
            <p className="text-sm text-muted-foreground">
              Connect your Maya number to receive lister payouts instantly.
            </p>
          </div>
          <MayaForm
            defaultValues={{
              method: "maya",
              maya_phone_number: profile.maya_phone_number ?? "",
            }}
            isPending={isPending}
            onSubmit={handleMethodSubmit}
          />
        </div>
      ) : null}

      {activeMethod === "bank" ? (
        <>
          <Separator />
          <div
            className="rounded-3xl border border-border/70 bg-white p-6 shadow-sm"
            id="kyc-section"
          >
            <div className="mb-5 space-y-1">
              <h3 className="text-lg font-semibold text-brand-navy">KYC Verification</h3>
              <p className="text-sm text-muted-foreground">
                Bank payouts require identity verification for security.
              </p>
            </div>
            <KYCUpload
              currentDocumentUrl={profile.bank_kyc_document_url ?? undefined}
              isVerified={Boolean(profile.bank_kyc_verified)}
              onSuccess={() => router.refresh()}
              userId={profile.id}
            />
            {!payoutStatus.is_complete && !isPending ? (
              <p className="mt-4 text-sm text-muted-foreground">
                Complete KYC verification to unlock listing creation with bank payouts.
              </p>
            ) : null}
          </div>
        </>
      ) : null}

      {isPending ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Saving payout details...
        </div>
      ) : null}
    </div>
  );
}
