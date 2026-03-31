"use client";

import type { ReactNode } from "react";
import { CheckCircle2, MapPin, Truck } from "lucide-react";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn, formatCurrency } from "@/lib/utils";
import type { FulfillmentType } from "@/types";

interface FulfillmentSelectorProps {
  deliveryAvailable: boolean;
  deliveryFee: number;
  deliveryRadius?: number | null;
  pickupLocation: string;
  value: FulfillmentType;
  onChange: (type: FulfillmentType) => void;
}

interface OptionCardProps {
  description: string;
  disabled?: boolean;
  icon: ReactNode;
  isSelected: boolean;
  label: string;
  meta: string;
  onClick: () => void;
}

function OptionCard({
  description,
  disabled = false,
  icon,
  isSelected,
  label,
  meta,
  onClick,
}: OptionCardProps) {
  return (
    <button
      className={cn(
        "relative flex min-h-32 flex-col rounded-2xl border p-4 text-left transition",
        isSelected
          ? "border-primary bg-primary/5 shadow-sm"
          : "border-border/70 bg-background hover:border-primary/40",
        disabled && "cursor-not-allowed opacity-50 hover:border-border/70",
      )}
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex size-10 items-center justify-center rounded-full bg-muted text-foreground">
          {icon}
        </div>
        {isSelected ? <CheckCircle2 className="size-5 text-primary" /> : null}
      </div>
      <div className="mt-4 space-y-1">
        <p className="font-medium">{label}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <p className="mt-auto pt-4 text-sm font-medium">{meta}</p>
    </button>
  );
}

export function FulfillmentSelector({
  deliveryAvailable,
  deliveryFee,
  deliveryRadius,
  pickupLocation,
  value,
  onChange,
}: FulfillmentSelectorProps) {
  const deliveryMeta = `${formatCurrency(deliveryFee)} delivery fee${
    deliveryRadius ? ` • within ${deliveryRadius}km` : ""
  }`;

  return (
    <TooltipProvider>
      <div className="grid gap-3 sm:grid-cols-2">
        <OptionCard
          description="Pick up from lister's location"
          icon={<MapPin className="size-5" />}
          isSelected={value === "pickup"}
          label="Pickup"
          meta={pickupLocation || "Pickup location provided by lister"}
          onClick={() => onChange("pickup")}
        />

        {deliveryAvailable ? (
          <OptionCard
            description="Deliver to your address"
            icon={<Truck className="size-5" />}
            isSelected={value === "delivery"}
            label="Delivery"
            meta={deliveryMeta}
            onClick={() => onChange("delivery")}
          />
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>
              <div>
                <OptionCard
                  description="Delivery is not available for this listing"
                  disabled
                  icon={<Truck className="size-5" />}
                  isSelected={false}
                  label="Delivery"
                  meta="Unavailable"
                  onClick={() => undefined}
                />
              </div>
            </TooltipTrigger>
            <TooltipContent sideOffset={8}>
              Delivery is not available for this listing.
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </TooltipProvider>
  );
}
