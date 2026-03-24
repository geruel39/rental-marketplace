"use client";

import Link from "next/link";
import { useActionState, useEffect, useMemo, useState, useTransition } from "react";
import {
  addDays,
  differenceInCalendarDays,
  differenceInHours,
  format,
  startOfDay,
} from "date-fns";
import { CalendarIcon, Minus, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { createBookingRequest } from "@/actions/bookings";
import { getOrCreateConversation } from "@/actions/messages";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { cn, formatCurrency } from "@/lib/utils";
import type { ActionResponse, Listing, PricingPeriod } from "@/types";

interface BookingWidgetProps {
  listing: Listing;
  isOwner: boolean;
  isLoggedIn: boolean;
  currentUserId?: string;
}

const initialState: ActionResponse | null = null;
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

export function BookingWidget({
  listing,
  isOwner,
  isLoggedIn,
  currentUserId,
}: BookingWidgetProps) {
  const router = useRouter();
  const [isMessagePending, startMessageTransition] = useTransition();
  const tomorrow = useMemo(() => addDays(new Date(), 1), []);
  const pricingOptions = useMemo(() => getAvailablePricingOptions(listing), [listing]);
  const [state, formAction, isPending] = useActionState(createBookingRequest, initialState);
  const [startDate, setStartDate] = useState<Date | undefined>(tomorrow);
  const [endDate, setEndDate] = useState<Date | undefined>(addDays(tomorrow, 1));
  const [quantity, setQuantity] = useState(1);
  const [pricingPeriod, setPricingPeriod] = useState<PricingPeriod>(
    listing.primary_pricing_period,
  );
  const [message, setMessage] = useState("");
  const [startOpen, setStartOpen] = useState(false);
  const [endOpen, setEndOpen] = useState(false);
  const isOutOfStock = listing.track_inventory && listing.quantity_available === 0;
  const maxQuantity = listing.track_inventory ? Math.max(1, listing.quantity_available) : null;
  const selectedUnitPrice =
    pricingOptions.find((option) => option.value === pricingPeriod)?.price ??
    getPrimaryPrice(listing) ??
    0;
  const numUnits = getNumUnits(startDate, endDate, pricingPeriod);
  const subtotal = selectedUnitPrice * Math.max(numUnits, 0) * quantity;
  const serviceFee = subtotal * SERVICE_FEE_RATE;
  const depositAmount = (listing.deposit_amount ?? 0) * quantity;
  const deliveryFee = listing.delivery_available ? listing.delivery_fee : 0;
  const total = subtotal + serviceFee + depositAmount + deliveryFee;
  const formDisabled =
    isPending ||
    isOwner ||
    isOutOfStock ||
    !startDate ||
    !endDate ||
    endDate <= startDate;

  useEffect(() => {
    if (state?.success) {
      toast.success(state.success);
      router.push("/dashboard/my-rentals");
      router.refresh();
    }
  }, [router, state?.success]);

  function updateQuantity(nextQuantity: number) {
    if (maxQuantity !== null) {
      setQuantity(Math.max(1, Math.min(maxQuantity, nextQuantity)));
      return;
    }

    setQuantity(Math.max(1, nextQuantity));
  }

  function getSubmitLabel() {
    if (!isLoggedIn) return "Login to Book";
    if (isOwner) return "This is your listing";
    if (isOutOfStock) return "Currently Unavailable";
    return listing.instant_book ? "Book Now" : "Request to Book";
  }

  function handleMessageClick() {
    if (!isLoggedIn) {
      router.push(`/login?redirectedFrom=/listings/${listing.id}`);
      return;
    }

    if (isOwner) {
      return;
    }

    startMessageTransition(async () => {
      try {
        const conversationId = await getOrCreateConversation(
          listing.id,
          listing.owner_id,
          currentUserId ?? "",
        );

        router.push(`/dashboard/messages/${conversationId}`);
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Could not open conversation",
        );
      }
    });
  }

  return (
    <div className="rounded-3xl border border-border/70 bg-card p-5 shadow-sm md:sticky md:top-20">
      <div className="space-y-2">
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
      </div>

      {listing.track_inventory ? (
        <div
          className={cn(
            "mt-4 rounded-2xl px-4 py-3 text-sm font-medium",
            isOutOfStock
              ? "bg-destructive/10 text-destructive"
              : listing.quantity_available <= (listing.low_stock_threshold ?? 1)
                ? "bg-amber-100 text-amber-800"
                : "bg-emerald-100 text-emerald-800",
          )}
        >
          {isOutOfStock
            ? "Out of Stock"
            : listing.quantity_available <= (listing.low_stock_threshold ?? 1)
              ? `Low Stock - only ${listing.quantity_available} left`
              : `${listing.quantity_available} available`}
        </div>
      ) : null}

      <form
        action={formAction}
        className="mt-5 space-y-4"
        onSubmit={(event) => {
          if (!startDate || !endDate || endDate <= startDate) {
            event.preventDefault();
            toast.error("Choose a valid date range first.");
          }
        }}
      >
        {state?.error ? (
          <Alert variant="destructive">
            <AlertDescription>{state.error}</AlertDescription>
          </Alert>
        ) : null}

        <input name="listing_id" type="hidden" value={listing.id} />
        <input
          name="start_date"
          type="hidden"
          value={startDate ? format(startDate, "yyyy-MM-dd") : ""}
        />
        <input
          name="end_date"
          type="hidden"
          value={endDate ? format(endDate, "yyyy-MM-dd") : ""}
        />
        <input name="quantity" type="hidden" value={quantity} />
        <input name="pricing_period" type="hidden" value={pricingPeriod} />
        <input name="message" type="hidden" value={message} />

        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-1 xl:grid-cols-2">
          <div className="space-y-2">
            <Label>Start Date</Label>
            <Popover onOpenChange={setStartOpen} open={startOpen}>
              <PopoverTrigger asChild>
                <Button className="w-full justify-between" disabled={formDisabled} variant="outline">
                  {startDate ? format(startDate, "PPP") : "Select date"}
                  <CalendarIcon className="size-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-auto p-0">
                <Calendar
                  disabled={(date) => date < tomorrow}
                  mode="single"
                  onSelect={(date) => {
                    setStartDate(date);
                    if (date && endDate && endDate <= date) {
                      setEndDate(addDays(date, 1));
                    }
                    setStartOpen(false);
                  }}
                  selected={startDate}
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label>End Date</Label>
            <Popover onOpenChange={setEndOpen} open={endOpen}>
              <PopoverTrigger asChild>
                <Button className="w-full justify-between" disabled={formDisabled} variant="outline">
                  {endDate ? format(endDate, "PPP") : "Select date"}
                  <CalendarIcon className="size-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-auto p-0">
                <Calendar
                  disabled={(date) =>
                    date < tomorrow || Boolean(startDate && date <= startDate)
                  }
                  mode="single"
                  onSelect={(date) => {
                    setEndDate(date);
                    setEndOpen(false);
                  }}
                  selected={endDate}
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="booking-quantity">Quantity</Label>
          <div className="flex items-center gap-2">
            <Button
              disabled={formDisabled || quantity <= 1}
              onClick={() => updateQuantity(quantity - 1)}
              size="icon"
              type="button"
              variant="outline"
            >
              <Minus className="size-4" />
            </Button>
            <Input
              className="text-center"
              disabled={formDisabled}
              id="booking-quantity"
              max={maxQuantity ?? undefined}
              min={1}
              onChange={(event) => updateQuantity(Number(event.target.value) || 1)}
              type="number"
              value={quantity}
            />
            <Button
              disabled={formDisabled || (maxQuantity !== null && quantity >= maxQuantity)}
              onClick={() => updateQuantity(quantity + 1)}
              size="icon"
              type="button"
              variant="outline"
            >
              <Plus className="size-4" />
            </Button>
          </div>
        </div>

        {pricingOptions.length > 1 ? (
          <div className="space-y-2">
            <Label>Pricing Period</Label>
            <RadioGroup
              className="gap-2"
              onValueChange={(value) => setPricingPeriod(value as PricingPeriod)}
              value={pricingPeriod}
            >
              {pricingOptions.map((option) => (
                <label
                  key={option.value}
                  className="flex items-center justify-between rounded-2xl border border-border px-3 py-2 text-sm"
                >
                  <span className="flex items-center gap-2">
                    <RadioGroupItem value={option.value} />
                    {option.label}
                  </span>
                  <span className="text-muted-foreground">{formatCurrency(option.price)}</span>
                </label>
              ))}
            </RadioGroup>
          </div>
        ) : null}

        <div className="rounded-2xl bg-muted/40 p-4 text-sm">
          <div className="flex justify-between gap-3">
            <span className="text-muted-foreground">
              {formatCurrency(selectedUnitPrice)} x {Math.max(numUnits, 0)} x {quantity}
            </span>
            <span>{formatCurrency(subtotal)}</span>
          </div>
          <div className="mt-2 flex justify-between gap-3">
            <span className="text-muted-foreground">Service fee (5%)</span>
            <span>{formatCurrency(serviceFee)}</span>
          </div>
          <div className="mt-2 flex justify-between gap-3">
            <span className="text-muted-foreground">Security deposit</span>
            <span>{formatCurrency(depositAmount)}</span>
          </div>
          {listing.delivery_available ? (
            <div className="mt-2 flex justify-between gap-3">
              <span className="text-muted-foreground">Delivery fee</span>
              <span>{formatCurrency(deliveryFee)}</span>
            </div>
          ) : null}
          <div className="my-3 border-t border-border" />
          <div className="flex justify-between gap-3 text-base font-semibold">
            <span>Total</span>
            <span>{formatCurrency(total)}</span>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="booking-message">Message to the lister</Label>
          <Textarea
            disabled={formDisabled}
            id="booking-message"
            onChange={(event) => setMessage(event.target.value)}
            placeholder="Share pickup details, questions, or anything the lister should know."
            value={message}
          />
        </div>

        {!isLoggedIn ? (
          <Button asChild className="w-full">
            <Link href={`/login?redirectedFrom=/listings/${listing.id}`}>{getSubmitLabel()}</Link>
          </Button>
        ) : (
          <div className="space-y-2">
            <Button className="w-full" disabled={formDisabled} type="submit">
              {isPending ? "Submitting..." : getSubmitLabel()}
            </Button>
            {!isOwner ? (
              <Button
                className="w-full"
                disabled={isMessagePending || !currentUserId}
                onClick={handleMessageClick}
                type="button"
                variant="outline"
              >
                {isMessagePending ? "Opening chat..." : "Message Lister"}
              </Button>
            ) : null}
          </div>
        )}
      </form>
    </div>
  );
}
