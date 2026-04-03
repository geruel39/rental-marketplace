"use client";

import Link from "next/link";
import { startTransition, useActionState, useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { Loader2, Minus, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { createBookingRequest } from "@/actions/bookings";
import { StockLevelBadge } from "@/components/inventory/stock-level-badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { cn, formatCurrency } from "@/lib/utils";
import type { ActionResponse, Listing, PricingPeriod } from "@/types";

interface BookingWidgetProps {
  listing: Listing;
  isOwner: boolean;
  isLoggedIn: boolean;
  currentUserId?: string;
}

type BookingFormValues = {
  rental_units: number;
  quantity: number;
  pricing_period: PricingPeriod;
  message: string;
};

const initialState: ActionResponse | null = null;
const RENTER_SERVICE_FEE_RATE = 0.05;

function getPricingOptions(listing: Listing) {
  return [
    { value: "hour" as const, short: "hr", label: "hour", price: listing.price_per_hour },
    { value: "day" as const, short: "day", label: "day", price: listing.price_per_day },
    { value: "week" as const, short: "week", label: "week", price: listing.price_per_week },
    { value: "month" as const, short: "month", label: "month", price: listing.price_per_month },
  ].filter((option): option is { value: PricingPeriod; short: string; label: string; price: number } => typeof option.price === "number");
}

function getDefaultPricingPeriod(listing: Listing, options: ReturnType<typeof getPricingOptions>) {
  const preferred = options.find((option) => option.value === listing.primary_pricing_period);
  return preferred?.value ?? options[0]?.value ?? "day";
}

function formatDurationMeaning(units: number, period: PricingPeriod) {
  const safeUnits = Math.max(1, units);
  if (period === "hour") {
    return `${safeUnits} hour${safeUnits > 1 ? "s" : ""}`;
  }
  if (period === "day") {
    return `${safeUnits} day${safeUnits > 1 ? "s" : ""}`;
  }
  if (period === "week") {
    const days = safeUnits * 7;
    return `${safeUnits} week${safeUnits > 1 ? "s" : ""} (${days} days)`;
  }
  const days = safeUnits * 30;
  return `${safeUnits} month${safeUnits > 1 ? "s" : ""} (~${days} days)`;
}

export function BookingWidget({ listing, isOwner, isLoggedIn }: BookingWidgetProps) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState<ActionResponse | null, FormData>(
    createBookingRequest,
    initialState,
  );
  const pricingOptions = useMemo(() => getPricingOptions(listing), [listing]);
  const minRentalUnits = Math.max(1, listing.minimum_rental_period || 1);
  const isOutOfStock = listing.track_inventory && listing.quantity_available <= 0;
  const maxQuantity = listing.track_inventory ? Math.max(1, listing.quantity_available) : 99;
  const showQuantity = !listing.track_inventory || listing.quantity_available > 1;

  const form = useForm<BookingFormValues>({
    defaultValues: {
      rental_units: minRentalUnits,
      quantity: 1,
      pricing_period: getDefaultPricingPeriod(listing, pricingOptions),
      message: "",
    },
  });

  const pricingPeriod = form.watch("pricing_period");
  const rentalUnits = Number(form.watch("rental_units") || minRentalUnits);
  const quantity = showQuantity ? Number(form.watch("quantity") || 1) : 1;
  const message = form.watch("message") ?? "";

  const selectedPricing = pricingOptions.find((option) => option.value === pricingPeriod);
  const unitPrice = selectedPricing?.price ?? 0;
  const subtotal = unitPrice * Math.max(minRentalUnits, rentalUnits) * Math.max(1, quantity);
  const serviceFee = subtotal * RENTER_SERVICE_FEE_RATE;
  const deposit = (listing.deposit_amount ?? 0) * Math.max(1, quantity);
  const total = subtotal + serviceFee + deposit;

  useEffect(() => {
    if (!state?.success) {
      return;
    }
    toast.success(state.success);
    router.push("/dashboard/my-rentals");
    router.refresh();
  }, [router, state?.success]);

  useEffect(() => {
    if (!state?.error) {
      return;
    }
    toast.error(state.error);
  }, [state?.error]);

  function updateRentalUnits(next: number) {
    form.setValue("rental_units", Math.max(minRentalUnits, next), {
      shouldDirty: true,
      shouldValidate: true,
    });
  }

  function updateQuantity(next: number) {
    form.setValue("quantity", Math.min(maxQuantity, Math.max(1, next)), {
      shouldDirty: true,
      shouldValidate: true,
    });
  }

  function buildSubmitLabel() {
    if (!isLoggedIn) {
      return "Login to Book";
    }
    if (isOutOfStock) {
      return "Currently Unavailable";
    }
    return listing.instant_book ? "Book Now" : "Request to Book";
  }

  function onSubmit(values: BookingFormValues) {
    if (!pricingOptions.length) {
      toast.error("This listing has no pricing configured.");
      return;
    }

    const finalRentalUnits = Math.max(minRentalUnits, values.rental_units || minRentalUnits);
    const finalQuantity = showQuantity ? Math.min(maxQuantity, Math.max(1, values.quantity || 1)) : 1;
    const trimmedMessage = values.message?.trim() ?? "";

    if (trimmedMessage.length > 500) {
      form.setError("message", { message: "Message cannot exceed 500 characters." });
      return;
    }

    const formData = new FormData();
    formData.set("listing_id", listing.id);
    formData.set("rental_units", String(finalRentalUnits));
    formData.set("quantity", String(finalQuantity));
    formData.set("pricing_period", values.pricing_period);
    formData.set("message", trimmedMessage);

    startTransition(() => {
      formAction(formData);
    });
  }

  const periodLabel = selectedPricing?.label ?? pricingPeriod;
  const disabledForm = isOutOfStock || !pricingOptions.length || isOwner;

  return (
    <aside className="w-full rounded-3xl border border-border bg-white p-5 shadow-sm md:sticky md:top-20">
      {state?.error ? (
        <Alert className="mb-4" variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}

      <form className="space-y-6" onSubmit={form.handleSubmit(onSubmit)}>
        <section className="space-y-3">
          <div className="flex items-end gap-2">
            <p className="text-brand-navy text-2xl font-bold">{formatCurrency(unitPrice)}</p>
            <p className="text-sm text-muted-foreground">/{selectedPricing?.short ?? listing.primary_pricing_period}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {pricingOptions.map((option) => (
              <button
                className={cn(
                  "rounded-full border px-3 py-1 text-xs transition",
                  pricingPeriod === option.value
                    ? "border-brand-navy bg-brand-navy text-white"
                    : "border-border bg-brand-light text-brand-dark hover:border-brand-steel hover:text-brand-steel",
                )}
                disabled={disabledForm || isPending}
                key={option.value}
                onClick={() => form.setValue("pricing_period", option.value, { shouldDirty: true })}
                type="button"
              >
                {formatCurrency(option.price)}/{option.short}
              </button>
            ))}
          </div>
        </section>

        <section>
          <StockLevelBadge
            lowStockThreshold={listing.low_stock_threshold}
            quantityAvailable={listing.quantity_available}
            size="md"
            trackInventory={listing.track_inventory}
          />
        </section>

        <section className="space-y-2">
          <Label>How long do you want to rent?</Label>
          <div className="flex items-center gap-2">
            <Button
              className="border-brand-navy text-brand-navy hover:bg-brand-navy/10 hover:text-brand-navy"
              disabled={disabledForm || isPending || rentalUnits <= minRentalUnits}
              onClick={() => updateRentalUnits(rentalUnits - 1)}
              size="icon"
              type="button"
              variant="outline"
            >
              <Minus className="size-4" />
            </Button>
            <Input
              disabled={disabledForm || isPending}
              inputMode="numeric"
              min={minRentalUnits}
              {...form.register("rental_units", { valueAsNumber: true, min: minRentalUnits })}
            />
            <Button
              className="border-brand-navy text-brand-navy hover:bg-brand-navy/10 hover:text-brand-navy"
              disabled={disabledForm || isPending}
              onClick={() => updateRentalUnits(rentalUnits + 1)}
              size="icon"
              type="button"
              variant="outline"
            >
              <Plus className="size-4" />
            </Button>
            <span className="min-w-20 text-sm text-muted-foreground">
              {rentalUnits} {periodLabel}
              {rentalUnits > 1 ? "s" : ""}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">{formatDurationMeaning(rentalUnits, pricingPeriod)}</p>
        </section>

        {showQuantity ? (
          <section className="space-y-2">
            <Label>How many items?</Label>
            <div className="flex items-center gap-2">
              <Button
                className="border-brand-navy text-brand-navy hover:bg-brand-navy/10 hover:text-brand-navy"
                disabled={disabledForm || isPending || quantity <= 1}
                onClick={() => updateQuantity(quantity - 1)}
                size="icon"
                type="button"
                variant="outline"
              >
                <Minus className="size-4" />
              </Button>
              <Input
                disabled={disabledForm || isPending}
                inputMode="numeric"
                min={1}
                max={maxQuantity}
                {...form.register("quantity", {
                  valueAsNumber: true,
                  min: 1,
                  max: maxQuantity,
                })}
              />
              <Button
                className="border-brand-navy text-brand-navy hover:bg-brand-navy/10 hover:text-brand-navy"
                disabled={disabledForm || isPending || quantity >= maxQuantity}
                onClick={() => updateQuantity(quantity + 1)}
                size="icon"
                type="button"
                variant="outline"
              >
                <Plus className="size-4" />
              </Button>
            </div>
          </section>
        ) : null}

        <section className="space-y-2 rounded-2xl border border-border/70 bg-brand-light p-4">
          <p className="text-sm text-muted-foreground">
            {formatCurrency(unitPrice)} × {rentalUnits} {periodLabel}
            {rentalUnits > 1 ? "s" : ""} × {quantity} = {formatCurrency(subtotal)}
          </p>
          <p className="text-sm text-muted-foreground">Service fee (5%) = {formatCurrency(serviceFee)}</p>
          {deposit > 0 ? (
            <p className="text-sm text-muted-foreground">Security deposit = {formatCurrency(deposit)}</p>
          ) : null}
          {quantity > 1 ? (
            <p className="text-xs text-muted-foreground">
              Per item base: {formatCurrency(unitPrice * rentalUnits)}
            </p>
          ) : null}
          <Separator />
          <p className="flex items-center justify-between font-semibold text-brand-navy">
            <span>Total</span>
            <span>{formatCurrency(total)}</span>
          </p>
        </section>

        <section className="space-y-2">
          <Label htmlFor="booking-message">Message to lister (optional)</Label>
          <Textarea
            disabled={disabledForm || isPending}
            id="booking-message"
            maxLength={500}
            placeholder="Introduce yourself and let the lister know when you'd like to arrange pickup..."
            rows={4}
            {...form.register("message", { maxLength: 500 })}
          />
          <p className="text-right text-xs text-muted-foreground">{message.length}/500</p>
        </section>

        <section className="space-y-2">
          {!isLoggedIn ? (
            <Button asChild className="w-full border-brand-navy text-brand-navy hover:bg-brand-light" variant="outline">
              <Link href="/login">Login to Book</Link>
            </Button>
          ) : isOwner ? (
            <p className="text-center text-sm text-muted-foreground">This is your listing</p>
          ) : (
            <Button
              className="w-full bg-brand-navy text-white hover:bg-brand-steel"
              disabled={disabledForm || isPending}
              type="submit"
            >
              {isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              {buildSubmitLabel()}
            </Button>
          )}
        </section>

        <section className="space-y-1 text-xs text-muted-foreground">
          <p>Rental period starts when the lister confirms handover.</p>
          <p>Cancellation policy: {listing.cancellation_policy}</p>
        </section>
      </form>
    </aside>
  );
}
