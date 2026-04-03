"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";

import { updatePlatformSetting } from "@/actions/admin";
import { HydratedRelativeTime } from "@/components/shared/hydrated-relative-time";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { JsonValue } from "@/types";

type SettingMeta = {
  updatedBy: string;
  updatedAt: string;
};

type PlatformSettingsFormProps = {
  initialSettings: Record<string, JsonValue>;
  metadata: Record<string, SettingMeta | undefined>;
};

type SettingsState = {
  renter_service_fee_percent: number;
  lister_service_fee_percent: number;
  minimum_payout_amount: number;
  max_images_per_listing: number;
  max_title_length: number;
  min_description_length: number;
  new_listings_require_admin_approval: boolean;
  platform_name: string;
  platform_currency: string;
  maintenance_mode: boolean;
};

function toNumber(value: JsonValue | undefined, fallback: number) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function toBoolean(value: JsonValue | undefined, fallback = false) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  if (typeof value === "string") return ["true", "1", "yes", "on"].includes(value.toLowerCase());
  return fallback;
}

function toStringValue(value: JsonValue | undefined, fallback: string) {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function buildInitialState(settings: Record<string, JsonValue>): SettingsState {
  return {
    renter_service_fee_percent: toNumber(settings.renter_service_fee_percent, 5),
    lister_service_fee_percent: toNumber(settings.lister_service_fee_percent, 5),
    minimum_payout_amount: toNumber(settings.minimum_payout_amount, 10),
    max_images_per_listing: toNumber(settings.max_images_per_listing, 8),
    max_title_length: toNumber(settings.max_title_length, 100),
    min_description_length: toNumber(settings.min_description_length, 20),
    new_listings_require_admin_approval: toBoolean(
      settings.new_listings_require_admin_approval,
      false,
    ),
    platform_name: toStringValue(settings.platform_name, "RentHub"),
    platform_currency: toStringValue(settings.platform_currency, "SGD"),
    maintenance_mode: toBoolean(settings.maintenance_mode, false),
  };
}

function SettingHint({
  label,
  settingKey,
  metadata,
}: {
  label: string;
  settingKey: keyof SettingsState;
  metadata: Record<string, SettingMeta | undefined>;
}) {
  const details = metadata[settingKey];

  return (
    <div className="space-y-1">
      <p className="text-sm font-medium text-foreground">{label}</p>
      <p className="text-xs text-muted-foreground">
        {details
          ? (
            <>
              Last updated by {details.updatedBy} <HydratedRelativeTime value={details.updatedAt} />
            </>
          )
          : "No admin update recorded yet"}
      </p>
    </div>
  );
}

export function PlatformSettingsForm({
  initialSettings,
  metadata,
}: PlatformSettingsFormProps) {
  const router = useRouter();
  const initialState = useMemo(() => buildInitialState(initialSettings), [initialSettings]);
  const [savedState, setSavedState] = useState<SettingsState>(initialState);
  const [state, setState] = useState<SettingsState>(initialState);
  const [isPending, startTransition] = useTransition();

  const hasChanges = JSON.stringify(state) !== JSON.stringify(savedState);

  function updateField<Key extends keyof SettingsState>(key: Key, value: SettingsState[Key]) {
    setState((current) => ({ ...current, [key]: value }));
  }

  function handleSave() {
    startTransition(async () => {
      const changedEntries = (Object.keys(state) as Array<keyof SettingsState>).filter(
        (key) => state[key] !== savedState[key],
      );

      for (const key of changedEntries) {
        await updatePlatformSetting(key, state[key]);
      }

      setSavedState(state);
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <Card className="border-border/70 bg-white shadow-sm">
        <CardHeader>
          <CardTitle>Fees</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-5 md:grid-cols-3">
          <div className="space-y-2">
            <SettingHint label="Renter service fee %" metadata={metadata} settingKey="renter_service_fee_percent" />
            <Input
              min={0}
              onChange={(event) => updateField("renter_service_fee_percent", Number(event.target.value) || 0)}
              type="number"
              value={state.renter_service_fee_percent}
            />
          </div>
          <div className="space-y-2">
            <SettingHint label="Lister service fee %" metadata={metadata} settingKey="lister_service_fee_percent" />
            <Input
              min={0}
              onChange={(event) => updateField("lister_service_fee_percent", Number(event.target.value) || 0)}
              type="number"
              value={state.lister_service_fee_percent}
            />
          </div>
          <div className="space-y-2">
            <SettingHint label="Minimum payout amount" metadata={metadata} settingKey="minimum_payout_amount" />
            <Input
              min={0}
              onChange={(event) => updateField("minimum_payout_amount", Number(event.target.value) || 0)}
              type="number"
              value={state.minimum_payout_amount}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/70 bg-white shadow-sm">
        <CardHeader>
          <CardTitle>Listings</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-5 md:grid-cols-2">
          <div className="space-y-2">
            <SettingHint label="Max images per listing" metadata={metadata} settingKey="max_images_per_listing" />
            <Input
              min={1}
              onChange={(event) => updateField("max_images_per_listing", Number(event.target.value) || 1)}
              type="number"
              value={state.max_images_per_listing}
            />
          </div>
          <div className="space-y-2">
            <SettingHint label="Max title length" metadata={metadata} settingKey="max_title_length" />
            <Input
              min={1}
              onChange={(event) => updateField("max_title_length", Number(event.target.value) || 1)}
              type="number"
              value={state.max_title_length}
            />
          </div>
          <div className="space-y-2">
            <SettingHint label="Min description length" metadata={metadata} settingKey="min_description_length" />
            <Input
              min={1}
              onChange={(event) => updateField("min_description_length", Number(event.target.value) || 1)}
              type="number"
              value={state.min_description_length}
            />
          </div>
          <div className="flex items-start justify-between gap-4 rounded-2xl border border-brand-navy/10 bg-brand-light p-4">
            <SettingHint
              label="New listings require admin approval"
              metadata={metadata}
              settingKey="new_listings_require_admin_approval"
            />
            <Switch
              checked={state.new_listings_require_admin_approval}
              onCheckedChange={(checked) => updateField("new_listings_require_admin_approval", checked)}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/70 bg-white shadow-sm">
        <CardHeader>
          <CardTitle>Platform</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-5 md:grid-cols-2">
          <div className="space-y-2">
            <SettingHint label="Platform name" metadata={metadata} settingKey="platform_name" />
            <Input
              onChange={(event) => updateField("platform_name", event.target.value)}
              value={state.platform_name}
            />
          </div>
          <div className="space-y-2">
            <SettingHint label="Platform currency" metadata={metadata} settingKey="platform_currency" />
            <Label className="sr-only" htmlFor="platform-currency">
              Platform currency
            </Label>
            <Select
              onValueChange={(value) => updateField("platform_currency", value)}
              value={state.platform_currency}
            >
              <SelectTrigger id="platform-currency">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["SGD", "USD", "EUR", "GBP", "AUD"].map((currency) => (
                  <SelectItem key={currency} value={currency}>
                    {currency}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-2">
            <div className="flex items-start justify-between gap-4 rounded-2xl border border-red-200 bg-red-50 p-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-red-700">
                  <AlertTriangle className="size-4" />
                  <p className="text-sm font-semibold">Maintenance mode</p>
                </div>
                <p className="text-sm text-muted-foreground">
                  When enabled, non-admin visitors are redirected to the maintenance page immediately.
                </p>
                <p className="text-xs text-muted-foreground">
                  {metadata.maintenance_mode
                    ? (
                      <>
                        Last updated by {metadata.maintenance_mode.updatedBy}{" "}
                        <HydratedRelativeTime value={metadata.maintenance_mode.updatedAt} />
                      </>
                    )
                    : "No admin update recorded yet"}
                </p>
              </div>
              <Switch
                checked={state.maintenance_mode}
                onCheckedChange={(checked) => updateField("maintenance_mode", checked)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button
          className="bg-brand-navy text-white hover:bg-brand-steel"
          disabled={isPending || !hasChanges}
          onClick={handleSave}
          type="button"
        >
          {isPending ? "Saving Settings..." : "Save Settings"}
        </Button>
      </div>
    </div>
  );
}

