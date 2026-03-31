"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import {
  addDays,
  addHours,
  addMonths,
  addWeeks,
  differenceInCalendarDays,
  differenceInHours,
  format,
  startOfDay,
} from "date-fns";
import {
  CalendarIcon,
  Loader2,
  Minus,
  Plus,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { createBookingRequest } from "@/actions/bookings";
import { DeliveryAddressForm } from "@/components/bookings/delivery-address-form";
import { FulfillmentSelector } from "@/components/bookings/fulfillment-selector";
import { SchedulePicker } from "@/components/bookings/schedule-picker";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { cn, formatCurrency } from "@/lib/utils";
import type {
  ActionResponse,
  DeliveryAddress,
  FulfillmentType,
  Listing,
  PricingPeriod,
} from "@/types";

interface BookingWidgetProps {
  listing: Listing;
  isOwner: boolean;
  isLoggedIn: boolean;
  currentUserId?: string;
}

const SERVICE_FEE_RATE = 0.05;

function getAvailablePricingOptions(listing: Listing) {
  return [
    { value: "hour" as const, label: "Hourly", price: listing.price_per_hour },
    { value: "day" as const, label: "Daily", price: listing.price_per_day },
    { value: "week" as const, label: "Weekly", price: listing.price_per_week },
    { value: "month" as const, label: "Monthly", price: listing.price_per_month },
  ].filter((option): option is { value: PricingPeriod; label: string; price: number } =>
    typeof option.price === "number",
  );
}

function getPrimaryPrice(listing: Listing) {
  switch (listing.primary_pricing_period) {
    case "hour":
      return listing.price_per_hour;
    case "week":
      return listing.price_per_week;
    case "month":
      return listing.price_per_month;
    case "day":
    default:
      return listing.price_per_day;
  }
}

function getNumUnits(
  startDate: Date | undefined,
  endDate: Date | undefined,
  pricingPeriod: PricingPeriod,
) {
  if (!startDate || !endDate || endDate <= startDate) {
    return 0;
  }

  const normalizedStartDate = startOfDay(startDate);
  const normalizedEndDate = startOfDay(endDate);
  const calendarDayCount = differenceInCalendarDays(
    normalizedEndDate,
    normalizedStartDate,
  );

  switch (pricingPeriod) {
    case "hour":
      return Math.max(1, Math.ceil(differenceInHours(endDate, startDate)));
    case "week":
      return Math.max(1, Math.ceil(calendarDayCount / 7));
    case "month":
      return Math.max(1, Math.ceil(calendarDayCount / 30));
    case "day":
    default:
      return Math.max(1, calendarDayCount);
  }
}

function getMinimumEndDate(
  startDate: Date | undefined,
  minimumRentalPeriod: number,
  pricingPeriod: PricingPeriod,
) {
  if (!startDate) {
    return undefined;
  }

  switch (pricingPeriod) {
    case "hour":
      return addHours(startDate, minimumRentalPeriod);
    case "week":
      return addWeeks(startDate, minimumRentalPeriod);
    case "month":
      return addMonths(startDate, minimumRentalPeriod);
    case "day":
    default:
      return addDays(startDate, minimumRentalPeriod);
  }
}

function getPeriodLabel(period: PricingPeriod) {
  switch (period) {
    case "hour":
      return "hour";
    case "week":
      return "week";
    case "month":
      return "month";
    case "day":
    default:
      return "day";
  }
}

function getStockState(listing: Listing) {
  if (!listing.track_inventory) {
    return null;
  }

  if (listing.quantity_available === 0) {
    return {
      className: "bg-destructive/10 text-destructive",
      label: "Out of Stock",
    };
  }

  if (listing.quantity_available <= (listing.low_stock_threshold ?? 1)) {
    return {
      className: "bg-amber-100 text-amber-800",
      label: `Low Stock - only ${listing.quantity_available} left`,
    };
  }

  return {
    className: "bg-emerald-100 text-emerald-800",
    label: `${listing.quantity_available} available`,
  };
}

function formatPolicy(policy: string) {
  return policy.charAt(0).toUpperCase() + policy.slice(1);
}

export function BookingWidget({
  listing,
  isOwner,
  isLoggedIn,
}: BookingWidgetProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isMobileSheetOpen, setIsMobileSheetOpen] = useState(false);
  const [serverState, setServerState] = useState<ActionResponse | null>(null);
  const [clientErrors, setClientErrors] = useState<Record<string, string>>({});
  const [tomorrow] = useState(() => addDays(startOfDay(new Date()), 1));
  const [startOpen, setStartOpen] = useState(false);
  const [endOpen, setEndOpen] = useState(false);
  const pricingOptions = getAvailablePricingOptions(listing);
  const [fulfillmentType, setFulfillmentType] = useState<FulfillmentType>(
    listing.delivery_available ? "pickup" : "pickup",
  );
  const [pickupScheduledAt, setPickupScheduledAt] = useState<string>("");
  const [pickupNotes, setPickupNotes] = useState("");
  const [deliveryScheduledAt, setDeliveryScheduledAt] = useState<string>("");
  const [deliveryNotes, setDeliveryNotes] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState<DeliveryAddress>({
    address: "",
    city: "",
    state: "",
    postal_code: "",
  });
  const [startDate, setStartDate] = useState<Date | undefined>(tomorrow);
  const [endDate, setEndDate] = useState<Date | undefined>(addDays(tomorrow, 1));
  const [pricingPeriod, setPricingPeriod] = useState<PricingPeriod>(
    listing.primary_pricing_period,
  );
  const [quantity, setQuantity] = useState(1);
  const [message, setMessage] = useState("");
  const stockState = getStockState(listing);
  const isOutOfStock = listing.track_inventory && listing.quantity_available === 0;
  const selectedPrice =
    pricingOptions.find((option) => option.value === pricingPeriod)?.price ??
    getPrimaryPrice(listing) ??
    0;
  const numUnits = getNumUnits(startDate, endDate, pricingPeriod);
  const subtotal = selectedPrice * Math.max(numUnits, 0) * quantity;
  const serviceFee = subtotal * SERVICE_FEE_RATE;
  const depositAmount = (listing.deposit_amount ?? 0) * quantity;
  const appliedDeliveryFee =
    fulfillmentType === "delivery" ? listing.delivery_fee ?? 0 : 0;
  const total = subtotal + serviceFee + depositAmount + appliedDeliveryFee;
  const minimumEndDate = getMinimumEndDate(
    startDate,
    listing.minimum_rental_period,
    pricingPeriod,
  );
  const maxQuantity = listing.track_inventory
    ? Math.max(1, listing.quantity_available)
    : 99;

  function updateQuantity(nextQuantity: number) {
    setQuantity(Math.max(1, Math.min(maxQuantity, nextQuantity)));
  }

  function getSubmitLabel() {
    if (!isLoggedIn) return "Login to Book";
    if (isOwner) return "This is your listing";
    if (isOutOfStock) return "Currently Unavailable";
    return listing.instant_book ? "Book Now" : "Request to Book";
  }

  function validate() {
    const nextErrors: Record<string, string> = {};

    if (!startDate) {
      nextErrors.start_date = "Select a start date.";
    }

    if (!endDate) {
      nextErrors.end_date = "Select an end date.";
    }

    if (startDate && endDate && endDate <= startDate) {
      nextErrors.end_date = "End date must be after the start date.";
    }

    if (minimumEndDate && endDate && endDate < minimumEndDate) {
      nextErrors.end_date = `End date must meet the minimum rental period of ${listing.minimum_rental_period} ${getPeriodLabel(pricingPeriod)}${listing.minimum_rental_period > 1 ? "s" : ""}.`;
    }

    if (fulfillmentType === "pickup" && !pickupScheduledAt) {
      nextErrors.pickup_scheduled_at = "Select a pickup date and time.";
    }

    if (fulfillmentType === "delivery") {
      if (!deliveryAddress.address.trim()) {
        nextErrors.delivery_address = "Delivery address is required.";
      }
      if (!deliveryAddress.city.trim()) {
        nextErrors.delivery_city = "Delivery city is required.";
      }
      if (!deliveryAddress.postal_code.trim()) {
        nextErrors.delivery_postal_code = "Postal code is required.";
      }
      if (!deliveryScheduledAt) {
        nextErrors.delivery_scheduled_at = "Select a delivery date and time.";
      }
    }

    setClientErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function submitBooking() {
    if (!isLoggedIn || isOwner || isOutOfStock || !validate()) {
      return;
    }

    const formData = new FormData();
    formData.set("listing_id", listing.id);
    formData.set("start_date", startDate ? format(startDate, "yyyy-MM-dd") : "");
    formData.set("end_date", endDate ? format(endDate, "yyyy-MM-dd") : "");
    formData.set("quantity", String(quantity));
    formData.set("pricing_period", pricingPeriod);
    formData.set("fulfillment_type", fulfillmentType);
    formData.set("message", message);
    formData.set("pickup_scheduled_at", fulfillmentType === "pickup" ? pickupScheduledAt : "");
    formData.set("pickup_notes", fulfillmentType === "pickup" ? pickupNotes : "");
    formData.set(
      "delivery_address",
      fulfillmentType === "delivery" ? deliveryAddress.address : "",
    );
    formData.set(
      "delivery_city",
      fulfillmentType === "delivery" ? deliveryAddress.city : "",
    );
    formData.set(
      "delivery_state",
      fulfillmentType === "delivery" ? deliveryAddress.state : "",
    );
    formData.set(
      "delivery_postal_code",
      fulfillmentType === "delivery" ? deliveryAddress.postal_code : "",
    );
    formData.set(
      "delivery_scheduled_at",
      fulfillmentType === "delivery" ? deliveryScheduledAt : "",
    );
    formData.set(
      "delivery_notes",
      fulfillmentType === "delivery" ? deliveryNotes : "",
    );

    startTransition(async () => {
      const result = await createBookingRequest(null, formData);
      setServerState(result);

      if (result.error) {
        toast.error(result.error);
        return;
      }

      if (result.success) {
        toast.success(result.success);
        setIsMobileSheetOpen(false);
        router.push("/dashboard/my-rentals");
        router.refresh();
      }
    });
  }

  function renderDatePicker(params: {
    error?: string;
    label: string;
    minDate?: Date;
    onOpenChange: (open: boolean) => void;
    onSelect: (date: Date | undefined) => void;
    open: boolean;
    value?: Date;
  }) {
    return (
      <div className="space-y-2">
        <Label>{params.label}</Label>
        <Popover onOpenChange={params.onOpenChange} open={params.open}>
          <PopoverTrigger asChild>
            <Button
              className={cn(
                "w-full justify-between",
                params.error && "border-destructive text-destructive hover:text-destructive",
              )}
              type="button"
              variant="outline"
            >
              <span>{params.value ? format(params.value, "PPP") : "Select date"}</span>
              <CalendarIcon className="size-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-auto p-0">
            <Calendar
              disabled={(date) => Boolean(params.minDate && date < params.minDate)}
              mode="single"
              onSelect={(date) => {
                params.onSelect(date);
                params.onOpenChange(false);
              }}
              selected={params.value}
            />
          </PopoverContent>
        </Popover>
        {params.error ? <p className="text-xs text-destructive">{params.error}</p> : null}
      </div>
    );
  }

  function renderSubmitButton() {
    if (!isLoggedIn) {
      return (
        <Button asChild className="w-full">
          <Link href="/login">Login to Book</Link>
        </Button>
      );
    }

    return (
      <Button className="w-full" disabled={isPending || isOwner || isOutOfStock} onClick={submitBooking} type="button">
        {isPending ? <Loader2 className="size-4 animate-spin" /> : null}
        {getSubmitLabel()}
      </Button>
    );
  }

  const bookingFormContent = (
    <div className="space-y-6">
        {serverState?.error ? (
          <Alert variant="destructive">
            <AlertDescription>{serverState.error}</AlertDescription>
          </Alert>
        ) : null}

        <section className="space-y-3">
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-semibold">
              {formatCurrency(getPrimaryPrice(listing) ?? 0)}
            </span>
            <span className="text-muted-foreground">/{listing.primary_pricing_period}</span>
          </div>
          {pricingOptions.length > 1 ? (
            <div className="space-y-1 text-sm text-muted-foreground">
              {pricingOptions.map((option) => (
                <p key={option.value}>
                  {option.label}: {formatCurrency(option.price)} / {option.value}
                </p>
              ))}
            </div>
          ) : null}
        </section>

        {stockState ? (
          <section
            className={cn(
              "rounded-2xl px-4 py-3 text-sm font-medium",
              stockState.className,
            )}
          >
            {stockState.label}
          </section>
        ) : null}

        <section className="space-y-3">
          <div className="space-y-1">
            <h3 className="font-medium">Fulfillment</h3>
            <p className="text-sm text-muted-foreground">
              Choose how you want to receive the item.
            </p>
          </div>

          {listing.delivery_available ? (
            <FulfillmentSelector
              deliveryAvailable={listing.delivery_available}
              deliveryFee={listing.delivery_fee}
              deliveryRadius={listing.delivery_radius_km}
              onChange={setFulfillmentType}
              pickupLocation={listing.location}
              value={fulfillmentType}
            />
          ) : (
            <div className="rounded-2xl border border-border/70 bg-muted/30 p-4 text-sm text-muted-foreground">
              Pickup only. Pick up from {listing.location}.
            </div>
          )}
        </section>

        <section className="space-y-4">
          {fulfillmentType === "pickup" ? (
            <>
              <SchedulePicker
                error={clientErrors.pickup_scheduled_at}
                label="Pickup Date and Time"
                minDate={tomorrow}
                onChange={setPickupScheduledAt}
                value={pickupScheduledAt}
              />
              <div className="space-y-2">
                <Label htmlFor="pickup-notes">Pickup Notes</Label>
                <Textarea
                  id="pickup-notes"
                  onChange={(event) => setPickupNotes(event.target.value)}
                  placeholder="Any pickup instructions..."
                  rows={3}
                  value={pickupNotes}
                />
              </div>
              <p className="text-sm text-muted-foreground">
                Pickup location: {listing.location}
              </p>
            </>
          ) : (
            <>
              <DeliveryAddressForm
                errors={clientErrors}
                onChange={setDeliveryAddress}
                value={deliveryAddress}
              />
              <SchedulePicker
                error={clientErrors.delivery_scheduled_at}
                label="Delivery Date and Time"
                minDate={tomorrow}
                onChange={setDeliveryScheduledAt}
                value={deliveryScheduledAt}
              />
              <div className="space-y-2">
                <Label htmlFor="delivery-notes">Delivery Notes</Label>
                <Textarea
                  id="delivery-notes"
                  onChange={(event) => setDeliveryNotes(event.target.value)}
                  placeholder="Any delivery notes..."
                  rows={3}
                  value={deliveryNotes}
                />
              </div>
              {listing.delivery_radius_km ? (
                <p className="text-sm text-muted-foreground">
                  Delivery within {listing.delivery_radius_km}km
                </p>
              ) : null}
            </>
          )}
        </section>

        <section className="space-y-4">
          <div className="space-y-1">
            <h3 className="font-medium">Rental Period</h3>
            <p className="text-sm text-muted-foreground">
              Minimum rental period: {listing.minimum_rental_period} {getPeriodLabel(pricingPeriod)}
              {listing.minimum_rental_period > 1 ? "s" : ""}
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {renderDatePicker({
              error: clientErrors.start_date,
              label: "Start Date",
              minDate: tomorrow,
              onOpenChange: setStartOpen,
              onSelect: (date) => {
                setStartDate(date);
                if (!date) {
                  return;
                }

                const nextMinEnd = getMinimumEndDate(
                  date,
                  listing.minimum_rental_period,
                  pricingPeriod,
                );

                if (nextMinEnd && (!endDate || endDate < nextMinEnd)) {
                  setEndDate(nextMinEnd);
                }
              },
              open: startOpen,
              value: startDate,
            })}

            {renderDatePicker({
              error: clientErrors.end_date,
              label: "End Date",
              minDate: minimumEndDate ?? tomorrow,
              onOpenChange: setEndOpen,
              onSelect: setEndDate,
              open: endOpen,
              value: endDate,
            })}
          </div>

          {pricingOptions.length > 1 ? (
            <div className="space-y-2">
              <Label>Pricing Period</Label>
              <RadioGroup
                className="grid gap-3 sm:grid-cols-2"
                onValueChange={(value) => {
                  const nextPeriod = value as PricingPeriod;
                  setPricingPeriod(nextPeriod);
                  const nextMinEndDate = getMinimumEndDate(
                    startDate,
                    listing.minimum_rental_period,
                    nextPeriod,
                  );

                  if (nextMinEndDate && (!endDate || endDate < nextMinEndDate)) {
                    setEndDate(nextMinEndDate);
                  }
                }}
                value={pricingPeriod}
              >
                {pricingOptions.map((option) => (
                  <label
                    key={option.value}
                    className={cn(
                      "flex cursor-pointer items-center justify-between rounded-2xl border border-border/70 p-3",
                      pricingPeriod === option.value && "border-primary bg-primary/5",
                    )}
                  >
                    <div>
                      <p className="font-medium">{option.label}</p>
                      <p className="text-sm text-muted-foreground">
                        {formatCurrency(option.price)} / {option.value}
                      </p>
                    </div>
                    <RadioGroupItem value={option.value} />
                  </label>
                ))}
              </RadioGroup>
            </div>
          ) : null}
        </section>

        <section className="space-y-2">
          <Label htmlFor="booking-quantity">Quantity</Label>
          <div className="flex items-center gap-2">
            <Button
              aria-label="Decrease quantity"
              disabled={isOutOfStock || quantity <= 1}
              onClick={() => updateQuantity(quantity - 1)}
              size="icon"
              type="button"
              variant="outline"
            >
              <Minus className="size-4" />
            </Button>
            <Input
              id="booking-quantity"
              inputMode="numeric"
              max={maxQuantity}
              min={1}
              onChange={(event) => updateQuantity(Number(event.target.value) || 1)}
              value={quantity}
            />
            <Button
              aria-label="Increase quantity"
              disabled={isOutOfStock || quantity >= maxQuantity}
              onClick={() => updateQuantity(quantity + 1)}
              size="icon"
              type="button"
              variant="outline"
            >
              <Plus className="size-4" />
            </Button>
          </div>
        </section>

        <section className="space-y-3 rounded-2xl border border-border/70 bg-muted/20 p-4">
          <div className="flex items-center justify-between text-sm">
            <span>
              {formatCurrency(selectedPrice)} × {Math.max(numUnits, 0)} × {quantity}
            </span>
            <span>{formatCurrency(subtotal)}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span>Service fee (5%)</span>
            <span>{formatCurrency(serviceFee)}</span>
          </div>
          {depositAmount > 0 ? (
            <div className="flex items-center justify-between text-sm">
              <span>Security deposit</span>
              <span>{formatCurrency(depositAmount)}</span>
            </div>
          ) : null}
          <div className="flex items-center justify-between text-sm">
            <span>Delivery fee</span>
            <span>{formatCurrency(appliedDeliveryFee)}</span>
          </div>
          <Separator />
          <div className="flex items-center justify-between text-base font-semibold">
            <span>Total</span>
            <span>{formatCurrency(total)}</span>
          </div>
        </section>

        <section className="space-y-2">
          <Label htmlFor="booking-message">Message to lister</Label>
          <Textarea
            id="booking-message"
            onChange={(event) => setMessage(event.target.value)}
            placeholder="Message to lister (optional)"
            rows={4}
            value={message}
          />
        </section>

        <section className="space-y-3">
          {renderSubmitButton()}
          <div className="space-y-1 text-xs text-muted-foreground">
            <p>
              {fulfillmentType === "pickup"
                ? `You'll pick up from: ${listing.location}`
                : "Delivery to your address"}
            </p>
            <p>Cancellation policy: {formatPolicy(listing.cancellation_policy)}</p>
            <p>Payment must be completed within 24 hours of acceptance</p>
          </div>
        </section>
      </div>
  );

  return (
    <>
      <div className="hidden rounded-3xl border border-border/70 bg-card p-5 shadow-sm md:sticky md:top-20 md:block">
        {bookingFormContent}
      </div>

      <div className="md:hidden">
        {isLoggedIn && !isOwner && !isOutOfStock ? (
          <Sheet onOpenChange={setIsMobileSheetOpen} open={isMobileSheetOpen}>
            <SheetTrigger asChild>
              <Button className="fixed right-4 bottom-4 left-4 z-40 rounded-full shadow-lg">
                {listing.instant_book ? "Book Now" : "Request to Book"}
              </Button>
            </SheetTrigger>
            <SheetContent className="max-h-[90vh] overflow-y-auto rounded-t-3xl" side="bottom">
              <SheetHeader className="px-5 pt-5 pb-2 text-left">
                <SheetTitle>Book This Item</SheetTitle>
              <SheetDescription>
                  Choose fulfillment, dates, and quantity before sending your booking.
                </SheetDescription>
              </SheetHeader>
              <div className="px-5 pb-8">
                {bookingFormContent}
              </div>
            </SheetContent>
          </Sheet>
        ) : (
          <div className="mt-6 rounded-3xl border border-border/70 bg-card p-5 shadow-sm">
            {bookingFormContent}
          </div>
        )}
      </div>
    </>
  );
}
