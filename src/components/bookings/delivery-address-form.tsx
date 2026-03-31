"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { DeliveryAddress } from "@/types";

interface DeliveryAddressFormProps {
  value: DeliveryAddress;
  onChange: (address: DeliveryAddress) => void;
  errors?: Record<string, string>;
}

interface FieldProps {
  error?: string;
  id: string;
  label: string;
  onChange: (value: string) => void;
  placeholder?: string;
  value: string;
}

function Field({ error, id, label, onChange, placeholder, value }: FieldProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        aria-invalid={Boolean(error)}
        className={cn(error && "border-destructive focus-visible:ring-destructive/40")}
        id={id}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        value={value}
      />
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

export function DeliveryAddressForm({
  value,
  onChange,
  errors,
}: DeliveryAddressFormProps) {
  return (
    <div className="space-y-4">
      <Field
        error={errors?.delivery_address}
        id="delivery-address"
        label="Delivery Address"
        onChange={(address) => onChange({ ...value, address })}
        placeholder="123 Main Street"
        value={value.address}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          error={errors?.delivery_city}
          id="delivery-city"
          label="City"
          onChange={(city) => onChange({ ...value, city })}
          placeholder="Quezon City"
          value={value.city}
        />
        <Field
          error={errors?.delivery_state}
          id="delivery-state"
          label="State"
          onChange={(state) => onChange({ ...value, state })}
          placeholder="Metro Manila"
          value={value.state}
        />
      </div>

      <Field
        error={errors?.delivery_postal_code}
        id="delivery-postal-code"
        label="Postal Code"
        onChange={(postal_code) => onChange({ ...value, postal_code })}
        placeholder="1100"
        value={value.postal_code}
      />
    </div>
  );
}
